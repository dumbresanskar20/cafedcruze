const jwt = require('jsonwebtoken');
const { pool } = require('../database/db');

/**
 * Middleware to verify Super-Admin JWT token and ensure account is active.
 * SuperAdmin authentication is strictly isolated from client-admins and students.
 */
const verifySuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Super-Admin authentication token required.',
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production';

    const decoded = jwt.verify(token, secret);

    if (decoded.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Super-Admin privilege required.',
      });
    }

    const [rows] = await pool.execute(
      'SELECT id, name, email, role, is_active FROM `SuperAdmin` WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(403).json({
        success: false,
        message: 'Super-Admin account not found or has been deactivated.',
      });
    }

    req.superAdmin = rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Super-Admin session expired. Please sign in again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid Super-Admin authentication token.',
    });
  }
};

module.exports = {
  verifySuperAdmin,
};
