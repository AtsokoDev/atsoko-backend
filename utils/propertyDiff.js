/**
 * Property Diff Utility
 * Compares two property data objects and returns structured diff
 */

// Fields to exclude from diff comparison (metadata, not content)
const EXCLUDED_FIELDS = [
    'id', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
    'publication_status', 'moderation_status'
];

// Fields that contain JSON arrays and need deep comparison
const JSON_ARRAY_FIELDS = ['features', 'labels', 'images', 'tags'];

/**
 * Parse a value that might be a JSON string into its native type
 */
const parseJsonSafe = (value) => {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    return value;
};

/**
 * Deep equal comparison for values
 */
const deepEqual = (a, b) => {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;

    // Parse JSON strings for comparison
    const parsedA = parseJsonSafe(a);
    const parsedB = parseJsonSafe(b);

    if (typeof parsedA !== typeof parsedB) return false;

    if (Array.isArray(parsedA) && Array.isArray(parsedB)) {
        if (parsedA.length !== parsedB.length) return false;
        return parsedA.every((val, idx) => deepEqual(val, parsedB[idx]));
    }

    if (typeof parsedA === 'object' && parsedA !== null) {
        const keysA = Object.keys(parsedA);
        const keysB = Object.keys(parsedB);
        if (keysA.length !== keysB.length) return false;
        return keysA.every(key => deepEqual(parsedA[key], parsedB[key]));
    }

    // Numeric comparison (handle string numbers)
    if (!isNaN(parsedA) && !isNaN(parsedB)) {
        return Number(parsedA) === Number(parsedB);
    }

    return parsedA === parsedB;
};

/**
 * Compute diff between two property data objects
 *
 * @param {Object} liveData - Current live property data
 * @param {Object} pendingData - Pending version data
 * @param {Object} options - { includeUnchanged: false }
 * @returns {Object} { changes: [...], summary: { total, changed, added, removed } }
 */
const computeDiff = (liveData, pendingData, options = {}) => {
    const { includeUnchanged = false } = options;
    const changes = [];

    // Get all fields from both objects
    const allFields = new Set([
        ...Object.keys(liveData || {}),
        ...Object.keys(pendingData || {})
    ]);

    for (const field of allFields) {
        // Skip excluded fields
        if (EXCLUDED_FIELDS.includes(field)) continue;

        const oldValue = liveData ? liveData[field] : undefined;
        const newValue = pendingData ? pendingData[field] : undefined;

        const isEqual = deepEqual(oldValue, newValue);

        if (!isEqual) {
            const change = {
                field,
                old: oldValue !== undefined ? oldValue : null,
                new: newValue !== undefined ? newValue : null,
                type: oldValue === undefined || oldValue === null
                    ? 'added'
                    : (newValue === undefined || newValue === null ? 'removed' : 'modified')
            };

            // For JSON array fields, compute added/removed items
            if (JSON_ARRAY_FIELDS.includes(field)) {
                const oldArr = parseJsonSafe(oldValue) || [];
                const newArr = parseJsonSafe(newValue) || [];

                if (Array.isArray(oldArr) && Array.isArray(newArr)) {
                    change.added_items = newArr.filter(item => !oldArr.includes(item));
                    change.removed_items = oldArr.filter(item => !newArr.includes(item));
                }
            }

            changes.push(change);
        } else if (includeUnchanged) {
            changes.push({
                field,
                old: oldValue,
                new: newValue,
                type: 'unchanged'
            });
        }
    }

    // Sort: modified first, then added, then removed
    const typeOrder = { modified: 0, added: 1, removed: 2, unchanged: 3 };
    changes.sort((a, b) => (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99));

    return {
        changes,
        summary: {
            total: changes.length,
            changed: changes.filter(c => c.type !== 'unchanged').length,
            added: changes.filter(c => c.type === 'added').length,
            removed: changes.filter(c => c.type === 'removed').length,
            modified: changes.filter(c => c.type === 'modified').length
        }
    };
};

/**
 * Create a snapshot of property data (excluding metadata fields)
 *
 * @param {Object} property - Full property row from database
 * @returns {Object} Snapshot data suitable for storing in version_data
 */
const createSnapshot = (property) => {
    const snapshot = { ...property };

    // Remove metadata fields that shouldn't be in snapshot
    const metaFields = [
        'id', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
        'publication_status', 'moderation_status'
    ];
    metaFields.forEach(f => delete snapshot[f]);

    return snapshot;
};

/**
 * Apply version data to a property (merge snapshot back)
 * Returns the SET clauses and params for SQL update
 *
 * @param {Object} versionData - The version_data JSONB from property_versions
 * @returns {{ setClauses: string[], params: any[], startIdx: number => ...}}
 */
const buildApplyVersionQuery = (versionData, startIdx = 1) => {
    const setClauses = [];
    const params = [];
    let idx = startIdx;

    // Fields that can be updated from version data
    const applyableFields = [
        'property_id', 'title', 'date', 'type', 'status', 'labels',
        'country', 'province', 'district', 'sub_district', 'location',
        'price', 'price_postfix', 'price_alternative', 'size', 'size_prefix',
        'terms_conditions', 'warehouse_length', 'electricity_system', 'clear_height',
        'features', 'landlord_name', 'landlord_contact', 'agent_team',
        'coordinates', 'floor_load', 'land_size', 'land_postfix',
        'building_type', 'remarks', 'slug', 'images',
        'type_id', 'status_id', 'subdistrict_id',
        'title_en', 'title_th', 'title_zh',
        'category', 'tags'
    ];

    for (const field of applyableFields) {
        if (field in versionData) {
            setClauses.push(`"${field}" = $${idx}`);
            params.push(versionData[field]);
            idx++;
        }
    }

    setClauses.push(`"updated_at" = NOW()`);

    return { setClauses, params, nextIdx: idx };
};

module.exports = {
    computeDiff,
    createSnapshot,
    buildApplyVersionQuery,
    deepEqual,
    parseJsonSafe,
    EXCLUDED_FIELDS,
    JSON_ARRAY_FIELDS
};
