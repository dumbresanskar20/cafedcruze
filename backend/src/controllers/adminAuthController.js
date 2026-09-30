const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const { pool } = require('../database/db');
const { sendAdminInvitation } = require('../services/otpService');

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

const createStaffSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'staff']).default('admin'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
});

const setPasswordSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'staff']).default('admin'),
});

const generateAdminToken = (admin) => {
  return jwt.sign(
    { id: admin.id, role: admin.role, username: admin.username },
    process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Admin Login
const loginAdmin = async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { usernameOrEmail, password } = parseResult.data;
    const searchParam = usernameOrEmail.toLowerCase().trim();

    const [rows] = await pool.execute(
      'SELECT * FROM AdminUser WHERE email = ? OR username = ? LIMIT 1',
      [searchParam, searchParam]
    );
    const admin = rows[0] || null;

    console.log(`[Admin Login Diagnostics] Search Param: ${searchParam}`);
    console.log(`[Admin Login Diagnostics] Admin found: ${admin ? 'YES' : 'NO'}`);
    
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    console.log(`[Admin Login Diagnostics] Match ID: ${admin.id}, Username: ${admin.username}, Email: ${admin.email}`);
    console.log(`[Admin Login Diagnostics] Role: ${admin.role}, Active: ${admin.is_active}, Verified: ${admin.is_verified}`);

    if (!admin.is_active) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated by Super Admin.' });
    }

    if (!admin.is_verified) {
      return res.status(403).json({ success: false, message: 'Account password not set yet. Please check your invitation email.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    console.log(`[Admin Login Diagnostics] Password comparison match: ${isMatch}`);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    // Audit trail: update last_login_at
    const now = new Date();
    await pool.execute(
      'UPDATE AdminUser SET last_login_at = ? WHERE id = ?',
      [now, admin.id]
    );

    const [updatedRows] = await pool.execute('SELECT * FROM AdminUser WHERE id = ? LIMIT 1', [admin.id]);
    const updatedAdmin = updatedRows[0];

    const token = generateAdminToken(updatedAdmin);

    // Check subscription status
    const { getOrCreateSubscriptionRecord } = require('./subscriptionController');
    const subscriptionRecord = await getOrCreateSubscriptionRecord();
    const isSubExpired = subscriptionRecord.status !== 'active' || new Date(subscriptionRecord.subscription_end_date) < now;

    return res.status(200).json({
      success: true,
      message: 'Admin login successful!',
      token,
      subscription_expired: isSubExpired,
      subscription: subscriptionRecord,
      admin: {
        id: updatedAdmin.id,
        _id: updatedAdmin.id,
        username: updatedAdmin.username,
        email: updatedAdmin.email,
        role: updatedAdmin.role,
        last_login_at: updatedAdmin.last_login_at,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during admin login.' });
  }
};

// Create new Staff account (Super Admin only)
const createStaffAccount = async (req, res) => {
  try {
    const parseResult = createStaffSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { username, email, role, password } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.trim();

    const [emailRows] = await pool.execute('SELECT id FROM AdminUser WHERE email = ? LIMIT 1', [cleanEmail]);
    const [userRows] = await pool.execute('SELECT id FROM AdminUser WHERE username = ? LIMIT 1', [cleanUsername]);

    if (emailRows.length > 0 || userRows.length > 0) {
      return res.status(400).json({ success: false, message: 'An admin user with this username or email already exists.' });
    }

    let passwordHash;
    let isVerified = false;
    let verificationToken = null;

    if (password && password.trim().length >= 6) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
      isVerified = true;
    } else {
      verificationToken = crypto.randomBytes(32).toString('hex');
      passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
    }

    const [result] = await pool.execute(
      `INSERT INTO AdminUser (username, email, password_hash, role, is_active, is_verified, verification_token, created_by_id)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      [cleanUsername, cleanEmail, passwordHash, role, isVerified ? 1 : 0, verificationToken, req.admin.id]
    );

    const [newAdminRows] = await pool.execute('SELECT * FROM AdminUser WHERE id = ? LIMIT 1', [result.insertId]);
    const newAdmin = newAdminRows[0];

    let inviteLink = '';
    if (!isVerified) {
      const adminAppUrl = (process.env.FRONTEND_ADMIN_URL || 'http://localhost:5174').replace(/\/+$/, '');
      inviteLink = `${adminAppUrl}/set-password?token=${verificationToken}`;

      // Await email sending to prevent Vercel serverless function termination before complete
      try {
        await sendAdminInvitation(cleanEmail, cleanUsername, inviteLink);
      } catch (err) {
        console.warn('[Admin Invite] Email send warning:', err.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: isVerified
        ? `Account for ${cleanUsername} created successfully with password set!`
        : `Staff account for ${cleanUsername} created! Invitation link dispatched.`,
      inviteLink,
      account: {
        id: newAdmin.id,
        _id: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        is_verified: newAdmin.is_verified,
        created_by: req.admin.username,
      },
    });
  } catch (error) {
    console.error('Create staff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create staff account.' });
  }
};

// Forced Password Set via Token Link
const setStaffPassword = async (req, res) => {
  try {
    const parseResult = setPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: parseResult.error.errors.map((e) => e.message).join(', '),
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { token, password } = parseResult.data;

    const [rows] = await pool.execute('SELECT * FROM AdminUser WHERE verification_token = ? LIMIT 1', [token]);
    const admin = rows[0] || null;
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'This link has expired or was already used — please ask your admin to resend an invite.',
      });
    }

    if (!admin.is_active) {
      return res.status(403).json({
        success: false,
        message: 'This staff account has been deactivated. Please contact your Super Admin.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const now = new Date();

    await pool.execute(
      `UPDATE AdminUser 
       SET password_hash = ?, is_verified = 1, verification_token = NULL, last_login_at = ?
       WHERE id = ?`,
      [hashedPassword, now, admin.id]
    );

    const [updatedRows] = await pool.execute('SELECT * FROM AdminUser WHERE id = ? LIMIT 1', [admin.id]);
    const updatedAdmin = updatedRows[0];

    let jwtToken;
    try {
      jwtToken = generateAdminToken(updatedAdmin);
    } catch (tokenErr) {
      console.error('Token generation error after password reset:', tokenErr);
      return res.status(200).json({
        success: true,
        requires_login: true,
        message: 'Password set successfully — please sign in.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password set successfully! Redirecting to Admin Panel...',
      token: jwtToken,
      admin: {
        id: updatedAdmin.id,
        _id: updatedAdmin.id,
        username: updatedAdmin.username,
        email: updatedAdmin.email,
        role: updatedAdmin.role,
        last_login_at: updatedAdmin.last_login_at,
      },
    });
  } catch (error) {
    console.error('Set staff password error:', error);
    return res.status(500).json({ success: false, message: 'Failed to set password.' });
  }
};

// List all admin staff accounts (Super Admin only)
const listAdminAccounts = async (req, res) => {
  try {
    const [accounts] = await pool.query(
      `SELECT a.*, c.username AS creator_username, c.email AS creator_email
       FROM AdminUser a
       LEFT JOIN AdminUser c ON a.created_by_id = c.id
       ORDER BY a.created_at DESC`
    );

    // Reshape to match Mongoose .populate() response shape (created_by nested object)
    const shaped = accounts.map((a) => ({
      id: a.id,
      _id: a.id,
      username: a.username,
      email: a.email,
      role: a.role,
      is_active: a.is_active,
      is_verified: a.is_verified,
      last_login_at: a.last_login_at,
      created_at: a.created_at,
      created_by: a.created_by_id
        ? { _id: a.created_by_id, id: a.created_by_id, username: a.creator_username, email: a.creator_email }
        : null,
    }));

    return res.status(200).json({
      success: true,
      accounts: shaped,
    });
  } catch (error) {
    console.error('List admin accounts error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin accounts.' });
  }
};

// Toggle staff active/inactive status (Super Admin only)
const toggleStaffStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);

    const [rows] = await pool.execute('SELECT * FROM AdminUser WHERE id = ? LIMIT 1', [targetId]);
    const admin = rows[0] || null;

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (admin.id === req.admin.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    const nextActiveState = admin.is_active ? 0 : 1;
    await pool.execute('UPDATE AdminUser SET is_active = ? WHERE id = ?', [nextActiveState, targetId]);

    return res.status(200).json({
      success: true,
      message: `Account ${admin.username} is now ${nextActiveState ? 'Active' : 'Deactivated'}.`,
      is_active: Boolean(nextActiveState),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to toggle account status.' });
  }
};

// Delete staff account (Super Admin only - Hard Delete from Database)
const deleteStaffAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);

    const [rows] = await pool.execute('SELECT * FROM AdminUser WHERE id = ? LIMIT 1', [targetId]);
    const targetAccount = rows[0] || null;

    if (!targetAccount) {
      return res.status(404).json({ success: false, message: 'Staff account not found.' });
    }

    if (targetAccount.id === req.admin.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own super admin account.' });
    }

    if (targetAccount.role === 'super_admin') {
      return res.status(400).json({ success: false, message: 'Super Admin accounts cannot be deleted.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Unlink child accounts created by this admin before deletion to satisfy FK constraints
      await connection.execute(
        'UPDATE AdminUser SET created_by_id = NULL WHERE created_by_id = ?',
        [targetId]
      );

      // Hard Delete: permanently remove record from database
      await connection.execute('DELETE FROM AdminUser WHERE id = ?', [targetId]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return res.status(200).json({
      success: true,
      message: `Staff account ${targetAccount.username} permanently deleted from database.`,
      account_id: targetId,
    });
  } catch (error) {
    console.error('Delete staff account error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete staff account from database.' });
  }
};

// Get current admin profile
const getAdminProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    admin: req.admin,
  });
};

// Register a new Admin account (Public signup endpoint)
const registerAdmin = async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { username, email, password, role } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.trim();
    const targetRole = role === 'staff' ? 'staff' : 'admin';

    // Check if user already exists
    const [emailRows] = await pool.execute('SELECT id FROM AdminUser WHERE email = ? LIMIT 1', [cleanEmail]);
    const [userRows] = await pool.execute('SELECT id FROM AdminUser WHERE username = ? LIMIT 1', [cleanUsername]);

    if (emailRows.length > 0 || userRows.length > 0) {
      return res.status(400).json({ success: false, message: 'An account with this username or email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user into AdminUser with the selected role ('admin' or 'staff')
    await pool.execute(
      `INSERT INTO AdminUser (username, email, password_hash, role, is_active, is_verified)
       VALUES (?, ?, ?, ?, 1, 1)`,
      [cleanUsername, cleanEmail, passwordHash, targetRole]
    );

    const roleLabel = targetRole === 'staff' ? 'Kitchen Staff' : 'Canteen Admin';

    return res.status(201).json({
      success: true,
      message: `${roleLabel} account registered successfully! You can now log in.`,
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    return res.status(500).json({ success: false, message: 'Server error during admin registration.' });
  }
};

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// Change Password Controller for Admin and Kitchen Staff (Authenticated via Old Password verification)
const changePassword = async (req, res) => {
  try {
    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: parseResult.error.errors.map((e) => e.message).join(', '),
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { oldPassword, newPassword } = parseResult.data;
    const adminId = req.adminId || req.admin?.id;

    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Admin ID missing.' });
    }

    const [rows] = await pool.execute('SELECT * FROM AdminUser WHERE id = ? LIMIT 1', [adminId]);
    const admin = rows[0] || null;

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (!admin.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'New password cannot be the same as your current password.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.execute(
      'UPDATE AdminUser SET password_hash = ? WHERE id = ?',
      [hashedPassword, adminId]
    );

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully!',
    });
  } catch (error) {
    console.error('Admin change password error:', error);
    return res.status(500).json({ success: false, message: 'Failed to change password. Please try again.' });
  }
};

module.exports = {
  loginAdmin,
  registerAdmin,
  createStaffAccount,
  setStaffPassword,
  listAdminAccounts,
  toggleStaffStatus,
  deleteStaffAccount,
  getAdminProfile,
  changePassword,
};
