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
 * Check if user can modify a property
 * Admin can modify all, Agent can only modify pending properties in their team
 */
const canModifyProperty = (user, property) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'agent') {
        return property.agent_team === user.team && property.approve_status === 'pending';
    }
    return false;
};

module.exports = {
    authenticate,
    optionalAuth,
    authorize,
    canAccessProperty,
    canModifyProperty,
    removeSecretFields,
    SECRET_FIELDS,
    JWT_SECRET,
    JWT_EXPIRES_IN
};
