const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// =====================================================
// Activity Logs API
// Source of truth: workflow_history JOIN users JOIN properties
// No extra table — workflow_history IS the activity log
// =====================================================

// ─── Regex patterns that mark a reason as system-generated ───────────────────
// When matched → reason=null, is_system_reason=true (reason_raw keeps original)
const SYSTEM_REASON_RE = [
    /^agent submitted property for review/i,
    /^version submitted for review/i,
    /^requested edit/i,
    /^property approved and published/i,
    /^property soft deleted/i,
    /^property restored from trash/i,
    /^property published/i,
    /^agent created (edit|delete) request\. reason: n\/a$/i,
    /^delete request (approved|rejected)\. reason: n\/a$/i,
    /^(edit|delete) request (approved|rejected)\. reason: n\/a$/i,
];

const isSystemReason = (reason) => {
    if (!reason) return false;
    return SYSTEM_REASON_RE.some((re) => re.test(reason.trim()));
};

// ─── Post-process a single row: clean reason fields only ─────────────────────
const normalizeRow = (row) => {
    const raw = row.reason ?? null;
    const sys = isSystemReason(raw);

    return {
        ...row,
        reason:           sys ? null : raw,
        reason_raw:       raw,
        is_system_reason: sys,
    };
};

// ─── SQL fragments (kept JS constants for reuse across list + detail) ─────────

// Human-readable label — backward-compat, frontend should prefer event_type
const ACTION_LABEL_SQL = `
    CASE
        WHEN wh.reason ILIKE 'Property created (%'                                                  THEN 'Created Draft'
        WHEN wh.reason ILIKE 'Edit draft saved%'                                                    THEN 'Saved Draft'
        WHEN wh.new_moderation_status = 'pending_add'                                                THEN 'Add Listing'
        WHEN wh.new_moderation_status = 'pending_edit'                                               THEN 'Edit Request'
        WHEN wh.new_moderation_status = 'pending_delete'                                             THEN 'Delete Request'
        WHEN wh.new_publication_status = 'published'                                                 THEN 'Published'
        WHEN wh.new_publication_status = 'unpublished'                                               THEN 'Unpublished'
        WHEN wh.new_publication_status = 'deleted'                                                   THEN 'Deleted'
        WHEN wh.new_publication_status = 'draft'
             AND wh.previous_publication_status = 'deleted'                                          THEN 'Restored'
        WHEN wh.new_moderation_status LIKE 'rejected_%'                                              THEN 'Returned for Revision'
        ELSE 'Updated'
    END
`;

// event_type enum — priority order matters (most-specific first)
const EVENT_TYPE_SQL = `
    CASE
        WHEN wh.reason ILIKE 'Property created (%'                                                  THEN 'created'
        WHEN wh.reason ILIKE 'Edit draft saved%'                                                    THEN 'version_draft_saved'
        -- 1. Specific publication state transitions
        WHEN wh.new_publication_status = 'draft'
             AND wh.previous_publication_status = 'deleted'                                          THEN 'restored'
        WHEN wh.new_publication_status = 'deleted'                                                   THEN 'deleted'
        WHEN wh.new_publication_status = 'unpublished'                                               THEN 'unpublished'
        -- 1b. Explicit request events — evaluate before publication checks because some
        --     historical rows kept new_publication_status='published'
        WHEN wh.reason ILIKE 'Agent created delete request.%'                                        THEN 'requested_delete'
        WHEN wh.reason ILIKE 'Agent created edit request.%'                                          THEN 'requested_edit'
           -- 2. Return for revision vs complete rejection — evaluate before publication checks
           --    return (soft):    new_mod=rejected_edit, new_pub=null
           --    reject (hard):    new_mod=rejected_edit, new_pub=published  (after fix)
           --    reject historical: new_mod=none, new_pub=published, with nearby rejection note
        WHEN wh.new_moderation_status LIKE 'rejected_%'
             AND (wh.new_publication_status IS NULL
                  OR wh.new_publication_status != 'published')                                      THEN 'returned_for_revision'
        WHEN wh.new_moderation_status LIKE 'rejected_%'
             AND wh.new_publication_status = 'published'                                            THEN 'rejected'
        -- 2b. Historical complete reject on published (logged before fix: new_mod=none)
        WHEN wh.new_moderation_status = 'none'
             AND wh.previous_moderation_status = 'pending_edit'
             AND wh.new_publication_status = 'published'
               AND EXISTS (
                  SELECT 1
                  FROM property_notes pn
                  WHERE pn.property_id = wh.property_id
                    AND pn.author_id = wh.changed_by
                    AND pn.note_type = 'rejection'
                    AND pn.created_at BETWEEN wh.created_at - INTERVAL '10 seconds'
                                     AND wh.created_at + INTERVAL '10 seconds'
               )                                                                                      THEN 'rejected'
        -- 3. Approve decisions (publish wins over plain approve)
        WHEN wh.new_publication_status = 'published'                                                 THEN 'approved_and_published'
        WHEN wh.new_moderation_status = 'none'
             AND wh.previous_moderation_status LIKE 'pending_%'                                      THEN 'approved'
        -- 4. Submit for review (split by target)
        WHEN wh.new_moderation_status = 'pending_add'                                                THEN 'submitted_for_review'
        -- pending_edit: distinguish draft-created vs submitted for review
        -- edit_draft_created:        prev=none (brand-new draft via request-edit)
        -- submitted_edit_for_review: prev=pending_edit (first submit)
        --                            prev=rejected_edit (re-submit after revision)
        WHEN wh.new_moderation_status = 'pending_edit'
             AND (wh.previous_moderation_status IS NULL
                  OR wh.previous_moderation_status = 'none')                                        THEN 'edit_draft_created'
        WHEN wh.new_moderation_status = 'pending_edit'
             AND wh.previous_moderation_status IN ('pending_edit', 'rejected_edit')                 THEN 'submitted_edit_for_review'
        WHEN wh.new_moderation_status = 'pending_delete'                                             THEN 'submitted_delete_for_review'
        -- 5. Fallback
        ELSE 'updated_other'
    END
`;

// action_target — add | edit | delete | null
const ACTION_TARGET_SQL = `
    CASE
        WHEN wh.reason ILIKE 'Property created (%'                                                  THEN 'add'
        WHEN wh.reason ILIKE 'Edit draft saved%'                                                    THEN 'edit'
        WHEN wh.new_moderation_status      IN ('pending_add',    'rejected_add')    THEN 'add'
        WHEN wh.new_moderation_status      IN ('pending_edit',   'rejected_edit')   THEN 'edit'
        WHEN wh.new_moderation_status      IN ('pending_delete', 'rejected_delete') THEN 'delete'
        WHEN wh.previous_moderation_status IN ('pending_add',    'rejected_add')    THEN 'add'
        WHEN wh.previous_moderation_status IN ('pending_edit',   'rejected_edit')   THEN 'edit'
        WHEN wh.previous_moderation_status IN ('pending_delete', 'rejected_delete') THEN 'delete'
        ELSE NULL
    END
`;

// Shared SELECT block (same shape for list + detail)
// Note: Timestamps stored as naive (local Thai) → convert to Asia/Bangkok for consistency
const SELECT_COLS = `
    wh.id,
    -- Timestamps (naive stored as Thai local time, convert to Asia/Bangkok explicitly)
    wh.created_at AT TIME ZONE 'Asia/Bangkok'   AS occurred_at,
    wh.created_at                               AS time,
    -- Actor
    u.id                                    AS user_id,
    u.name                                  AS user_name,
    u.role                                  AS user_role,
    u.name                                  AS actor_name,
    u.role                                  AS actor_role,
    -- Action semantics
    (${ACTION_LABEL_SQL})                   AS action,
    (${EVENT_TYPE_SQL})                     AS event_type,
    (${ACTION_TARGET_SQL})                  AS action_target,
    -- Reason (raw; normalizeRow() will clean it)
    wh.reason,
    wh.reason                               AS detail,
    -- Raw status columns (backward-compat + frontend custom logic)
    wh.previous_moderation_status,
    wh.new_moderation_status,
    wh.previous_publication_status,
    wh.new_publication_status,
    -- Property
    p.id                                    AS property_db_id,
    p.property_id                           AS property_code,
    p.title                                 AS property_name,
    p.agent_team                            AS agent_team
`;

// ─── Filter whitelists ────────────────────────────────────────────────────────

// action_type → SQL (backward-compat param name kept; prefer event_type going forward)
const ACTION_TYPE_CONDITIONS = {
    created:        `wh.reason ILIKE 'Property created (%'`,
    add_listing:    `wh.new_moderation_status = 'pending_add'`,
    edit_request:   `wh.new_moderation_status = 'pending_edit'`,
    delete_request: `wh.new_moderation_status = 'pending_delete'`,
    publish:        `wh.new_publication_status = 'published'`,
    unpublish:      `wh.new_publication_status = 'unpublished'`,
    delete:         `wh.new_publication_status = 'deleted'`,
    restore:        `wh.new_publication_status = 'draft' AND wh.previous_publication_status = 'deleted'`,
    reject:         `wh.new_moderation_status LIKE 'rejected_%'`,
    approve:        `(wh.new_publication_status = 'published' OR (wh.new_moderation_status = 'none' AND wh.previous_moderation_status LIKE 'pending_%'))`,
};

// event_type → SQL (new, preferred)
const EVENT_TYPE_CONDITIONS = {
    created:                     `wh.reason ILIKE 'Property created (%'`,
    restored:                    `wh.new_publication_status = 'draft' AND wh.previous_publication_status = 'deleted'`,
    deleted:                     `wh.new_publication_status = 'deleted'`,
    unpublished:                 `wh.new_publication_status = 'unpublished'`,
    approved_and_published:      `wh.new_publication_status = 'published'`,
    approved:                    `wh.new_moderation_status = 'none' AND wh.previous_moderation_status LIKE 'pending_%'`,
    returned_for_revision:       `(wh.new_moderation_status LIKE 'rejected_%' AND (wh.new_publication_status IS NULL OR wh.new_publication_status != 'published'))`,
    rejected:                    `(wh.new_moderation_status LIKE 'rejected_%' AND wh.new_publication_status = 'published')
                                   OR (
                                       wh.new_moderation_status = 'none'
                                       AND wh.previous_moderation_status = 'pending_edit'
                                       AND wh.new_publication_status = 'published'
                                       AND EXISTS (
                                           SELECT 1
                                           FROM property_notes pn
                                           WHERE pn.property_id = wh.property_id
                                             AND pn.author_id = wh.changed_by
                                             AND pn.note_type = 'rejection'
                                             AND pn.created_at BETWEEN wh.created_at - INTERVAL '10 seconds'
                                                                   AND wh.created_at + INTERVAL '10 seconds'
                                       )
                                   )`,
    submitted_for_review:        `wh.new_moderation_status = 'pending_add'`,
    version_draft_saved:          `wh.reason ILIKE 'Edit draft saved%'`,
    edit_draft_created:          `wh.new_moderation_status = 'pending_edit' AND (wh.previous_moderation_status IS NULL OR wh.previous_moderation_status = 'none')`,
    submitted_edit_for_review:   `wh.new_moderation_status = 'pending_edit' AND wh.previous_moderation_status IN ('pending_edit','rejected_edit')`,
    submitted_delete_for_review: `wh.new_moderation_status = 'pending_delete'`,
    edit_request:                `wh.new_moderation_status = 'pending_edit'`,   // broad: covers both draft + submit
    requested_edit:              `(wh.reason ILIKE '%edit request%')`,
    requested_delete:            `(wh.reason ILIKE '%delete request%')`,
    updated_other:              `TRUE`,
};

// action_target → SQL
const ACTION_TARGET_CONDITIONS = {
    add:    `wh.new_moderation_status IN ('pending_add','rejected_add') OR wh.previous_moderation_status IN ('pending_add','rejected_add')`,
    edit:   `wh.new_moderation_status IN ('pending_edit','rejected_edit') OR wh.previous_moderation_status IN ('pending_edit','rejected_edit')`,
    delete: `wh.new_moderation_status IN ('pending_delete','rejected_delete') OR wh.previous_moderation_status IN ('pending_delete','rejected_delete')`,
};

const EVENT_TYPE_META = [
    { value: 'created', label: 'Created Draft' },
    { value: 'version_draft_saved', label: 'Saved Edit Draft' },
    { value: 'submitted_for_review', label: 'Submitted for Review' },
    { value: 'edit_draft_created', label: 'Created Edit Draft' },
    { value: 'submitted_edit_for_review', label: 'Submitted Edit for Review' },
    { value: 'submitted_delete_for_review', label: 'Submitted Delete for Review' },
    { value: 'requested_edit', label: 'Requested Edit' },
    { value: 'requested_delete', label: 'Requested Delete' },
    { value: 'returned_for_revision', label: 'Returned for Revision' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'approved_and_published', label: 'Approved & Published' },
    { value: 'approved', label: 'Approved' },
    { value: 'unpublished', label: 'Unpublished' },
    { value: 'deleted', label: 'Deleted' },
    { value: 'restored', label: 'Restored' },
    { value: 'updated_other', label: 'Updated' },
];

// ─── GET /api/activity-logs/meta ─────────────────────────────────────────────
// Returns canonical filter metadata for frontend dropdowns
// - event_types: source of truth for action dropdown labels
// - agent_teams: teams visible to current user (ACL-aware)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/meta', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const params = [];
        const conditions = [];

        if (req.user.role === 'agent') {
            params.push(req.user.team);
            conditions.push(`p.agent_team = $${params.length}`);
        }

        const whereSQL = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const teamResult = await pool.query(
            `SELECT DISTINCT p.agent_team AS team
             FROM workflow_history wh
             JOIN properties p ON p.id = wh.property_id
             ${whereSQL ? `${whereSQL} AND` : 'WHERE'} p.agent_team IS NOT NULL
             AND p.agent_team <> ''
             ORDER BY p.agent_team ASC`,
            params
        );

        const adminWhereSQL = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const adminResult = await pool.query(
            `SELECT 1
             FROM workflow_history wh
             JOIN users u ON u.id = wh.changed_by
             JOIN properties p ON p.id = wh.property_id
             ${adminWhereSQL ? `${adminWhereSQL} AND` : 'WHERE'} u.role = 'admin'
             LIMIT 1`,
            params
        );

        const teams = teamResult.rows
            .map((row) => String(row.team || '').trim().toUpperCase())
            .filter(Boolean);

        const uniqueTeams = [...new Set(teams)].map((team) => ({ value: team, label: team }));
        if (adminResult.rowCount > 0) {
            uniqueTeams.unshift({ value: 'ADMIN', label: 'Admin' });
        }

        res.json({
            success: true,
            data: {
                event_types: EVENT_TYPE_META,
                agent_teams: uniqueTeams,
            },
        });
    } catch (error) {
        console.error('[GET /activity-logs/meta] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// ─── GET /api/activity-logs ───────────────────────────────────────────────────
// Query params:
//   date_from    YYYY-MM-DD
//   date_to      YYYY-MM-DD
//   user_id      integer
//   action_type  backward-compat (see ACTION_TYPE_CONDITIONS)
//   event_type   preferred — see EVENT_TYPE_CONDITIONS keys
//   action_target add|edit|delete
//   agent_team   team code (e.g. A|B|C)
//   actor_role   admin|agent
//   search       property_id or title (partial)
//   page         default 1
//   limit        default 20 (max 100)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const {
            date_from,
            date_to,
            user_id,
            action_type,
            event_type,
            action_target,
            agent_team,
            actor_role,
            search,
            page  = 1,
            limit = 20,
        } = req.query;

        const safeLimit  = Math.min(parseInt(limit) || 20, 100);
        const safeOffset = ((parseInt(page) || 1) - 1) * safeLimit;

        // ── Build dynamic WHERE clauses ────────────────────────────────────
        const conditions = [];
        const params     = [];

        // ACL: agent only sees their team's properties
        if (req.user.role === 'agent') {
            params.push(req.user.team);
            conditions.push(`p.agent_team = $${params.length}`);
        }

        if (date_from) {
            params.push(date_from);
            // Convert naive timestamp to Thai timezone before comparing dates
            conditions.push(`(wh.created_at AT TIME ZONE 'Asia/Bangkok')::date >= $${params.length}::date`);
        }

        if (date_to) {
            params.push(date_to);
            // Convert naive timestamp to Thai timezone, make date_to exclusive (next day)
            conditions.push(`(wh.created_at AT TIME ZONE 'Asia/Bangkok')::date < ($${params.length}::date + INTERVAL '1 day')`);
        }

        if (user_id) {
            params.push(parseInt(user_id));
            conditions.push(`wh.changed_by = $${params.length}`);
        }

        if (actor_role && ['admin', 'agent'].includes(actor_role)) {
            params.push(actor_role);
            conditions.push(`u.role = $${params.length}`);
        }

        if (agent_team) {
            const normalizedTeam = String(agent_team).trim().toUpperCase();

            if (normalizedTeam === 'ADMIN') {
                conditions.push(`u.role = 'admin'`);
            } else {
                params.push(normalizedTeam);
                conditions.push(`p.agent_team = $${params.length}`);
                conditions.push(`u.role = 'agent'`);
            }
        }

        // event_type filter (preferred) — match the exact computed event_type used in response rows
        if (event_type && EVENT_TYPE_CONDITIONS[event_type]) {
            params.push(String(event_type).trim().toLowerCase());
            conditions.push(`(${EVENT_TYPE_SQL}) = $${params.length}`);
        }

        // action_type filter (backward-compat) — whitelist checked
        if (!event_type && action_type && ACTION_TYPE_CONDITIONS[action_type]) {
            conditions.push(`(${ACTION_TYPE_CONDITIONS[action_type]})`);
        }

        // action_target filter — whitelist checked
        if (action_target && ACTION_TARGET_CONDITIONS[action_target]) {
            conditions.push(`(${ACTION_TARGET_CONDITIONS[action_target]})`);
        }

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(p.property_id ILIKE $${params.length} OR p.title ILIKE $${params.length})`);
        }

        const whereSQL = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        // ── Queries ────────────────────────────────────────────────────────
        const dataQuery = `
            SELECT ${SELECT_COLS}
            FROM  workflow_history wh
            JOIN  users      u ON u.id  = wh.changed_by
            JOIN  properties p ON p.id  = wh.property_id
            ${whereSQL}
            ORDER BY wh.created_at DESC, wh.id DESC
            LIMIT  ${safeLimit}
            OFFSET ${safeOffset}
        `;

        const countQuery = `
            SELECT COUNT(*) AS total
            FROM  workflow_history wh
            JOIN  users      u ON u.id  = wh.changed_by
            JOIN  properties p ON p.id  = wh.property_id
            ${whereSQL}
        `;

        const [dataResult, countResult] = await Promise.all([
            pool.query(dataQuery, params),
            pool.query(countQuery, params),
        ]);

        const total      = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / safeLimit);

        res.json({
            success: true,
            data:       dataResult.rows.map(normalizeRow),
            pagination: {
                total,
                page:        parseInt(page) || 1,
                limit:       safeLimit,
                total_pages: totalPages,
            },
        });

    } catch (error) {
        console.error('[GET /activity-logs] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// ─── GET /api/activity-logs/users ────────────────────────────────────────────
// Returns user list for the filter dropdown
// Route order: /users before /:id so Express matches static before dynamic
// Only show users that have created activity logs (changed_by in workflow_history)
// Admin: all active users with logs | Agent: admins + own team members with logs
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        let query;
        let params = [];

        if (req.user.role === 'admin') {
            query = `
                SELECT DISTINCT u.id, u.name, u.role, u.team
                FROM   users u
                WHERE  u.is_active = true
                  AND  u.id IN (SELECT DISTINCT changed_by FROM workflow_history)
                ORDER  BY u.name
            `;
        } else {
            // Agent sees: admins (who process requests) + own team members
            // But only if they have activity logs
            params = [req.user.id, req.user.team];
            query = `
                SELECT DISTINCT u.id, u.name, u.role, u.team
                FROM   users u
                WHERE  u.is_active = true
                  AND  (u.role = 'admin' OR u.id = $1 OR u.team = $2)
                  AND  u.id IN (SELECT DISTINCT changed_by FROM workflow_history)
                ORDER  BY u.name
            `;
        }

        const result = await pool.query(query, params);

        res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error('[GET /activity-logs/users] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// ─── GET /api/activity-logs/:id ──────────────────────────────────────────────
// Single log entry — used by frontend detail page
// Regex :id(\\d+) ensures this never collides with /users
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id(\\d+)', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const logId = parseInt(req.params.id);

        const result = await pool.query(
            `SELECT ${SELECT_COLS}
             FROM  workflow_history wh
             JOIN  users      u ON u.id = wh.changed_by
             JOIN  properties p ON p.id = wh.property_id
             WHERE wh.id = $1`,
            [logId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Log entry not found' });
        }

        const log = normalizeRow(result.rows[0]);

        // ACL: agent can only view logs for their own team's properties
        if (req.user.role === 'agent') {
            const prop = await pool.query(
                'SELECT agent_team FROM properties WHERE id = $1',
                [log.property_db_id]
            );
            if (!prop.rows.length || prop.rows[0].agent_team !== req.user.team) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
        }

        res.json({ success: true, data: log });

    } catch (error) {
        console.error('[GET /activity-logs/:id] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
