const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const { authenticate, authorize, JWT_SECRET, JWT_EXPIRES_IN } = require('../middleware/auth');

const REFRESH_TOKEN_EXPIRES_DAYS = 7;

/**
 * Generate access token
 */
const generateAccessToken = (userId, role, team) => {
    return jwt.sign(
        { userId, role, team },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = async (userId) => {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

    await pool.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [userId, token, expiresAt]
    );

    return token;
};

/**
 * POST /api/auth/register
 * Create a new user (Admin only)
 */
router.post('/register', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { email, password, name, role = 'agent', team } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }

        // Validate role
        if (!['admin', 'agent'].includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Role must be either "admin" or "agent"'
            });
        }

        // Agents must have a team
        if (role === 'agent' && !team) {
            return res.status(400).json({
                success: false,
                error: 'Team is required for agents'
            });
        }

        // Validate team values
        if (team && !['A', 'B', 'C'].includes(team.toUpperCase())) {
            return res.status(400).json({
                success: false,
                error: 'Team must be A, B, or C'
            });
        }

        // Check if email already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Email already registered'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, name, role, team) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, name, role, team, created_at`,
            [email.toLowerCase(), passwordHash, name, role, team ? team.toUpperCase() : null]
        );

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create user'
        });
    }
});

/**
 * POST /api/auth/login
 * Login and get tokens
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Find user
        const result = await pool.query(
            'SELECT id, email, password_hash, name, role, team, is_active FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        const user = result.rows[0];

        // Check if user is active
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user.id, user.role, user.team);
        const refreshToken = await generateRefreshToken(user.id);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    team: user.team
                },
                accessToken,
                refreshToken,
                expiresIn: JWT_EXPIRES_IN
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout and revoke refresh token
 */
router.post('/logout', authenticate, async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            // Delete specific refresh token
            await pool.query(
                'DELETE FROM refresh_tokens WHERE user_id = $1 AND token = $2',
                [req.user.id, refreshToken]
            );
        } else {
            // Delete all refresh tokens for this user (logout from all devices)
            await pool.query(
                'DELETE FROM refresh_tokens WHERE user_id = $1',
                [req.user.id]
            );
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token is required'
            });
        }

        // Find refresh token
        const tokenResult = await pool.query(
            `SELECT rt.*, u.id as user_id, u.email, u.name, u.role, u.team, u.is_active 
       FROM refresh_tokens rt 
       JOIN users u ON rt.user_id = u.id 
       WHERE rt.token = $1`,
            [refreshToken]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid refresh token'
            });
        }

        const tokenData = tokenResult.rows[0];

        // Check if token is expired
        if (new Date() > new Date(tokenData.expires_at)) {
            // Delete expired token
            await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [tokenData.id]);
            return res.status(401).json({
                success: false,
                error: 'Refresh token expired'
            });
        }

        // Check if user is active
        if (!tokenData.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        // Generate new access token
        const accessToken = generateAccessToken(tokenData.user_id, tokenData.role, tokenData.team);

        res.json({
            success: true,
            data: {
                accessToken,
                expiresIn: JWT_EXPIRES_IN
            }
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh token'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name,
                role: req.user.role,
                team: req.user.team
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user info'
        });
    }
});

/**
 * GET /api/auth/users
 * Get all users (Admin only)
 */
router.get('/users', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, name, role, team, is_active, created_at FROM users ORDER BY created_at DESC'
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get users'
        });
    }
});

/**
 * PUT /api/auth/users/:id
 * Update user (Admin only)
 */
router.put('/users/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, role, team, is_active } = req.body;

        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (role !== undefined) {
            if (!['admin', 'agent'].includes(role)) {
                return res.status(400).json({
                    success: false,
                    error: 'Role must be either "admin" or "agent"'
                });
            }
            updates.push(`role = $${paramCount++}`);
            values.push(role);
        }
        if (team !== undefined) {
            if (team && !['A', 'B', 'C'].includes(team.toUpperCase())) {
                return res.status(400).json({
                    success: false,
                    error: 'Team must be A, B, or C'
                });
            }
            updates.push(`team = $${paramCount++}`);
            values.push(team ? team.toUpperCase() : null);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const result = await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} 
       RETURNING id, email, name, role, team, is_active, created_at, updated_at`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user'
        });
    }
});

module.exports = router;
