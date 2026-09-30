const jwt = require('jsonwebtoken');
const { pool } = require('../database/db');

// Middleware to verify Student JWT
const verifyStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production');

    if (decoded.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Forbidden. Student access required.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, name, email, phone, roll_no, is_verified, created_at FROM Student WHERE id = ? LIMIT 1',
      [decoded.id]
    );
    const student = rows[0] || null;

    if (!student) {
      return res.status(401).json({ success: false, message: 'Student account not found.' });
    }

    if (!student.is_verified) {
      return res.status(403).json({ success: false, message: 'Student email/account is not verified.' });
    }

    req.user = { ...student, _id: student.id };
    req.student = { ...student, _id: student.id };
    req.studentId = student.id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
};

// Middleware to optionally extract Student JWT if present (does not block if absent)
const optionalStudentAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
      return next();
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production');
    if (decoded.role === 'student') {
      const [rows] = await pool.execute(
        'SELECT id, name, email, phone, roll_no, is_verified, created_at FROM Student WHERE id = ? LIMIT 1',
        [decoded.id]
      );
      if (rows.length > 0) {
        req.student = rows[0];
        req.studentId = rows[0].id;
      }
    }
  } catch (err) {
    // Ignore invalid/expired token for optional middleware
  }
  next();
};

// Middleware to verify Admin JWT
const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn(`[verifyAdmin Auth Fail] Path: ${req.originalUrl} - No Bearer token provided in headers.`);
      return res.status(401).json({ success: false, code: 'NO_TOKEN', message: 'Authentication required. No token provided.' });
    }

    let token = authHeader.split(' ')[1];
    if (token) {
      token = token.replace(/^"(.*)"$/, '$1').trim();
    }

    if (!token || token === 'null' || token === 'undefined') {
      console.warn(`[verifyAdmin Auth Fail] Path: ${req.originalUrl} - Null or empty Bearer token value.`);
      return res.status(401).json({ success: false, code: 'NO_TOKEN', message: 'Authentication required. Invalid token format.' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production';
    const decoded = jwt.verify(token, jwtSecret);

    if (!['super_admin', 'admin', 'staff'].includes(decoded.role)) {
      console.warn(`[verifyAdmin Auth Fail] Path: ${req.originalUrl} - Invalid role: ${decoded.role}`);
      return res.status(403).json({ success: false, code: 'FORBIDDEN_ROLE', message: 'Forbidden. Admin access required.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, username, email, role, is_active, is_verified, last_login_at, created_at FROM AdminUser WHERE id = ? LIMIT 1',
      [decoded.id]
    );
    const admin = rows[0] || null;

    if (!admin) {
      console.warn(`[verifyAdmin Auth Fail] Path: ${req.originalUrl} - Admin ID ${decoded.id} not found in DB.`);
      return res.status(401).json({ success: false, code: 'ACCOUNT_NOT_FOUND', message: 'Admin account not found.' });
    }

    if (!admin.is_active) {
      console.warn(`[verifyAdmin Auth Fail] Path: ${req.originalUrl} - Admin account ${admin.username} is deactivated.`);
      return res.status(403).json({ success: false, code: 'ACCOUNT_DEACTIVATED', message: 'Admin account is deactivated.' });
    }

    req.admin = { ...admin, _id: admin.id };
    req.adminId = admin.id;
    next();
  } catch (error) {
    console.warn(`[verifyAdmin Auth Fail] Path: ${req.originalUrl} - JWT error: ${error.name} (${error.message})`);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Invalid authentication token.' });
  }
};

// Middleware to enforce specific admin roles (e.g., super_admin)
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of roles: [${roles.join(', ')}]`,
      });
    }
    next();
  };
};

// Middleware to verify Owner JWT specifically
const verifyOwner = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    let token = authHeader.split(' ')[1];
    if (token) {
      token = token.replace(/^"(.*)"$/, '$1').trim();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production');

    if (decoded.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Forbidden. Owner access required.' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM AdminUser WHERE id = ? AND role = ? LIMIT 1',
      [decoded.id, 'owner']
    );
    const owner = rows[0] || null;

    if (!owner) {
      return res.status(401).json({ success: false, message: 'Owner account not found.' });
    }

    if (!owner.is_active) {
      return res.status(403).json({ success: false, message: 'Owner account is deactivated.' });
    }

    req.owner = owner;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
};

module.exports = {
  verifyStudent,
  optionalStudentAuth,
  verifyAdmin,
  requireRole,
  verifyOwner,
};
