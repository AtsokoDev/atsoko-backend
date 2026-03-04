const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

// Secret fields that should be hidden from guests
const SECRET_FIELDS = ['coordinates', 'landlord_name', 'landlord_contact', 'agent_team'];

/**
 * Remove secret fields from property object(s)
 */
const removeSecretFields = (data) => {
    if (Array.isArray(data)) {
        return data.map(item => {
            const filtered = { ...item };
            SECRET_FIELDS.forEach(field => delete filtered[field]);
            return filtered;
        });
    } else if (data && typeof data === 'object') {
        const filtered = { ...data };
        SECRET_FIELDS.forEach(field => delete filtered[field]);
        return filtered;
    }
    return data;
};

/**
 * Authenticate middleware - requires valid JWT token
 * Attaches user to req.user
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Access denied. No token provided.'
            });
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, JWT_SECRET);

            // Get user from database to ensure they still exist and are active
            const result = await pool.query(
                'SELECT id, email, name, role, team, is_active FROM users WHERE id = $1',
                [decoded.userId]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    error: 'User not found.'
                });
            }

            const user = result.rows[0];

            if (!user.is_active) {
                return res.status(401).json({
                    success: false,
                    error: 'User account is deactivated.'
                });
            }

            req.user = user;
            next();
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token expired. Please refresh your token.'
                });
            }
            return res.status(401).json({
                success: false,
                error: 'Invalid token.'
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication error.'
        });
    }
};

/**
 * Optional auth middleware - attaches user if token is valid, but doesn't require it
 * Used for endpoints where guests can access but authenticated users get more data
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // DEBUG: Log authorization header
        console.log('[optionalAuth] Request path:', req.path);
        console.log('[optionalAuth] Authorization header present:', !!authHeader);
        console.log('[optionalAuth] Authorization header:', authHeader ? authHeader.substring(0, 30) + '...' : 'none');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No token - continue as guest
            console.log('[optionalAuth] No valid Bearer token - continuing as GUEST');
            req.user = null;
            return next();
        }

        const token = authHeader.split(' ')[1];
        console.log('[optionalAuth] Token length:', token.length);

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            console.log('[optionalAuth] Token decoded successfully. userId:', decoded.userId);

            const result = await pool.query(
                'SELECT id, email, name, role, team, is_active FROM users WHERE id = $1',
                [decoded.userId]
            );

            console.log('[optionalAuth] User query result count:', result.rows.length);

            if (result.rows.length > 0 && result.rows[0].is_active) {
                req.user = result.rows[0];
                console.log('[optionalAuth] User authenticated:', {
                    id: req.user.id,
                    email: req.user.email,
                    role: req.user.role,
                    team: req.user.team
                });
            } else {
                console.log('[optionalAuth] User not found or inactive - continuing as GUEST');
                req.user = null;
            }
        } catch (jwtError) {
            // Invalid token - continue as guest
            console.log('[optionalAuth] JWT Error:', jwtError.name, jwtError.message);
            req.user = null;
        }

        next();
    } catch (error) {
        console.error('[optionalAuth] Middleware error:', error);
        req.user = null;
        next();
    }
};

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Array of allowed roles (e.g., ['admin', 'agent'])
 */
const authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Access denied. Authentication required.'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Insufficient permissions.'
            });
        }

        next();
    };
};

/**
 * Check if user can access a specific property based on team
 * Admin can access all, Agent can only access their team's properties
 */
const canAccessProperty = (user, property) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'agent') {
        return property.agent_team === user.team;
    }
    return false;
};

/**
 * Check if user can modify a property directly
 * Uses publication_status + moderation_status
 *
 * - Admin can modify all properties (any status)
 * - Agent can modify their team's properties when:
 *     - Draft + moderation = none or rejected_add → editable
 *     - Unpublished + moderation = none → editable
 *     - Published → must use Request Edit (returns false)
 *     - Any pending moderation → locked (returns false)
 */
const canModifyProperty = (user, property) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'agent') {
        if (property.agent_team !== user.team) return false;

        const pubStatus = property.publication_status;
        const modStatus = property.moderation_status || 'none';

        // Published → agent must use Request Edit
        if (pubStatus === 'published') return false;

        // Locked during pending moderation
        if (['pending_add', 'pending_edit', 'pending_delete'].includes(modStatus)) return false;

        // Draft/Unpublished with none or rejected → editable
        if (pubStatus === 'draft' && ['none', 'rejected_add'].includes(modStatus)) return true;
        if (pubStatus === 'unpublished' && modStatus === 'none') return true;

        return false;
    }
    return false;
};

/**
 * Check if user can delete a property directly (soft delete)
 * - Admin can delete all properties
 * - Agent can delete their team's Draft or Unpublished properties
 * - Published properties → must use Request Delete
 */
const canDeleteProperty = (user, property) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'agent') {
        if (property.agent_team !== user.team) return false;

        const pubStatus = property.publication_status;
        const modStatus = property.moderation_status || 'none';

        // Published → must use Request Delete
        if (pubStatus === 'published') return false;

        // Cannot delete during pending moderation
        if (['pending_add', 'pending_edit', 'pending_delete'].includes(modStatus)) return false;

        // Draft or Unpublished → can delete
        if (['draft', 'unpublished'].includes(pubStatus)) return true;

        return false;
    }
    return false;
};

/**
 * Check what actions a user can perform on a property
 * Uses publication_status + moderation_status
 */
const getPropertyPermissions = (user, property) => {
    // Resolve status
    const pubStatus = property.publication_status;
    const modStatus = property.moderation_status || 'none';
    const isPublished = pubStatus === 'published';
    const isDraft = pubStatus === 'draft';
    const isUnpublished = pubStatus === 'unpublished';
    const isDeleted = pubStatus === 'deleted';
    const hasPendingMod = ['pending_add', 'pending_edit', 'pending_delete'].includes(modStatus);
    const hasRejectedMod = ['rejected_add', 'rejected_edit', 'rejected_delete'].includes(modStatus);

    if (!user) {
        return {
            canView: isPublished,
            canEdit: false,
            canDelete: false,
            canRequestEdit: false,
            canRequestDelete: false,
            canPublish: false,
            canUnpublish: false,
            canChangeWorkflow: false,
            canSubmitForReview: false,
            canEditPendingVersion: false
        };
    }

    if (user.role === 'admin') {
        return {
            canView: true,
            canEdit: true,
            canDelete: true,
            canRequestEdit: false, // Admin doesn't need to request
            canRequestDelete: false, // Admin doesn't need to request
            canPublish: !isPublished && !isDeleted,
            canUnpublish: isPublished,
            canChangeWorkflow: true,
            canSubmitForReview: false,
            canEditPendingVersion: false,
            canApprove: hasPendingMod,
            canReject: hasPendingMod,
            canRevert: isPublished
        };
    }

    if (user.role === 'agent') {
        const isOwnTeam = property.agent_team === user.team;

        return {
            canView: isOwnTeam,
            canEdit: isOwnTeam && !isPublished && !hasPendingMod && !isDeleted,
            canDelete: isOwnTeam && (isDraft || isUnpublished) && !hasPendingMod,
            canRequestEdit: isOwnTeam && isPublished && modStatus === 'none',
            canRequestDelete: isOwnTeam && isPublished && modStatus === 'none',
            canPublish: false,
            canUnpublish: false,
            canChangeWorkflow: false,
            canSubmitForReview: isOwnTeam && (
                (isDraft && modStatus === 'none') ||
                (isDraft && modStatus === 'rejected_add') ||
                (isUnpublished && modStatus === 'none')
            ),
            canEditPendingVersion: isOwnTeam && (
                modStatus === 'rejected_edit' ||
                (modStatus === 'pending_edit' && false) // pending = locked
            ),
            canApprove: false,
            canReject: false,
            canRevert: false
        };
    }

    return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canRequestEdit: false,
        canRequestDelete: false,
        canPublish: false,
        canUnpublish: false,
        canChangeWorkflow: false,
        canSubmitForReview: false,
        canEditPendingVersion: false
    };
};

/**
 * Moderation status transitions validation (new model)
 * Returns true if the transition is valid
 *
 * @param {string} currentModStatus - current moderation_status
 * @param {string} newModStatus - requested moderation_status
 * @param {string} userRole - 'admin' | 'agent'
 */
const isValidModerationTransition = (currentModStatus, newModStatus, userRole) => {
    // Admin can do any transition
    if (userRole === 'admin') return true;

    // Agent transitions:
    if (userRole === 'agent') {
        // rejected_add → pending_add  (resubmit after fix)
        if (currentModStatus === 'rejected_add' && newModStatus === 'pending_add') return true;
        // rejected_edit → pending_edit (resubmit after fix)
        if (currentModStatus === 'rejected_edit' && newModStatus === 'pending_edit') return true;
        // none → pending_add (submit draft)
        if (currentModStatus === 'none' && newModStatus === 'pending_add') return true;
        return false;
    }

    return false;
};

/**
 * DEPRECATED — Legacy workflow status transitions validation.
 * Use isValidModerationTransition instead.
 * Kept for backward compatibility during transition period.
 */
const isValidWorkflowTransition = (currentStatus, newStatus, userRole) => {
    console.warn('[DEPRECATED] isValidWorkflowTransition called. Use isValidModerationTransition.');
    if (userRole === 'admin') return true;
    if (userRole === 'agent') {
        // Legacy: wait_to_fix -> fixed (maps to rejected_* → pending_*)
        return currentStatus === 'wait_to_fix' && newStatus === 'fixed';
    }
    return false;
};

module.exports = {
    authenticate,
    optionalAuth,
    authorize,
    canAccessProperty,
    canModifyProperty,
    canDeleteProperty,
    getPropertyPermissions,
    isValidModerationTransition,
    isValidWorkflowTransition, // deprecated — kept for backward compat
    removeSecretFields,
    SECRET_FIELDS,
    JWT_SECRET,
    JWT_EXPIRES_IN
};
