const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const { pool } = require('../database/db');
const { generateOTP, sendOTP, sendForgotPasswordOTP } = require('../services/otpService');

// Zod schemas for input validation
const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Mobile number must be at least 10 digits').max(15, 'Mobile number is too long'),
  roll_no: z.string().optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().min(1, 'Email or mobile number is required'),
  identifier: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
});

const verifyOtpSchema = z.object({
  email: z.string().min(1, 'Email or mobile number is required'),
  otp_code: z.string().length(6, 'OTP must be 6 digits'),
});

const generateTokens = (student) => {
  const accessToken = jwt.sign(
    { id: student.id, role: 'student', email: student.email, phone: student.phone },
    process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production',
    { expiresIn: process.env.STUDENT_JWT_EXPIRES_IN || '3650d' }
  );

  const refreshToken = jwt.sign(
    { id: student.id, role: 'student' },
    process.env.JWT_REFRESH_SECRET || 'super_secret_jwt_refresh_key_change_in_production',
    { expiresIn: process.env.STUDENT_JWT_REFRESH_EXPIRES_IN || '3650d' }
  );

  return { accessToken, refreshToken };
};

// Signup controller
const registerStudent = async (req, res) => {
  try {
    const parseResult = signupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { name, email, phone, roll_no, password } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone ? phone.trim().replace(/\s+/g, '') : null;
    const cleanRollNo = roll_no && roll_no.trim() ? roll_no.trim() : null;

    // Check if a student already exists with email or phone
    const [emailRows] = await pool.execute('SELECT * FROM Student WHERE email = ? LIMIT 1', [cleanEmail]);
    const existingByEmail = emailRows[0] || null;

    let existingByPhone = null;
    if (cleanPhone) {
      const [phoneRows] = await pool.execute('SELECT * FROM Student WHERE phone = ? LIMIT 1', [cleanPhone]);
      existingByPhone = phoneRows[0] || null;
    }

    let existingByRollNo = null;
    if (cleanRollNo) {
      const [rollRows] = await pool.execute('SELECT * FROM Student WHERE roll_no = ? LIMIT 1', [cleanRollNo]);
      existingByRollNo = rollRows[0] || null;
    }

    // If verified account exists, block registration
    if (existingByEmail?.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    if (existingByPhone?.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'An account with this mobile number already exists.',
      });
    }

    if (existingByRollNo?.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'An account with this roll number already exists.',
      });
    }

    // Clean up unverified conflicting records
    if (existingByEmail && existingByRollNo && existingByEmail.id !== existingByRollNo.id) {
      await pool.execute('DELETE FROM Student WHERE id = ?', [existingByRollNo.id]);
    }
    if (existingByEmail && existingByPhone && existingByEmail.id !== existingByPhone.id) {
      await pool.execute('DELETE FROM Student WHERE id = ?', [existingByPhone.id]);
    }

    const unverifiedTarget = existingByEmail || existingByPhone || existingByRollNo;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let student;
    if (unverifiedTarget) {
      await pool.execute(
        `UPDATE Student SET name = ?, email = ?, phone = ?, roll_no = ?, password_hash = ?, is_verified = 1, otp_code = NULL, otp_expires_at = NULL 
         WHERE id = ?`,
        [name.trim(), cleanEmail, cleanPhone, cleanRollNo, hashedPassword, unverifiedTarget.id]
      );
      const [rows] = await pool.execute('SELECT * FROM Student WHERE id = ? LIMIT 1', [unverifiedTarget.id]);
      student = rows[0];
    } else {
      const [result] = await pool.execute(
        `INSERT INTO Student (name, email, phone, roll_no, password_hash, is_verified) 
         VALUES (?, ?, ?, ?, ?, 1)`,
        [name.trim(), cleanEmail, cleanPhone, cleanRollNo, hashedPassword]
      );
      const [rows] = await pool.execute('SELECT * FROM Student WHERE id = ? LIMIT 1', [result.insertId]);
      student = rows[0];
    }

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Please log in with your credentials.',
      email: cleanEmail,
      phone: cleanPhone,
    });
  } catch (error) {
    console.error('Student registration error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// OTP verification controller
const verifyOTP = async (req, res) => {
  try {
    const parseResult = verifyOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { email, otp_code } = parseResult.data;
    const identifier = email.trim();

    let rows;
    if (identifier.includes('@')) {
      [rows] = await pool.execute('SELECT * FROM Student WHERE email = ? LIMIT 1', [identifier.toLowerCase()]);
    } else {
      const cleanPhone = identifier.replace(/\s+/g, '');
      [rows] = await pool.execute('SELECT * FROM Student WHERE phone = ? OR email = ? LIMIT 1', [cleanPhone, identifier.toLowerCase()]);
    }
    const student = rows[0] || null;

    if (!student) {
      return res.status(404).json({ success: false, message: 'No account found with this email or mobile number.' });
    }

    if (student.is_verified) {
      const { accessToken, refreshToken } = generateTokens(student);
      return res.status(200).json({
        success: true,
        message: 'Account is already verified.',
        accessToken,
        refreshToken,
        student: {
          id: student.id,
          _id: student.id,
          name: student.name,
          email: student.email,
          phone: student.phone,
          roll_no: student.roll_no,
        },
      });
    }

    if (!student.otp_code || student.otp_code !== otp_code.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    if (!student.otp_expires_at || student.otp_expires_at < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
    }

    await pool.execute(
      'UPDATE Student SET is_verified = 1, otp_code = NULL, otp_expires_at = NULL WHERE id = ?',
      [student.id]
    );

    const [updatedRows] = await pool.execute('SELECT * FROM Student WHERE id = ? LIMIT 1', [student.id]);
    const updatedStudent = updatedRows[0];

    const { accessToken, refreshToken } = generateTokens(updatedStudent);

    return res.status(200).json({
      success: true,
      message: 'Account verified successfully!',
      accessToken,
      refreshToken,
      student: {
        id: updatedStudent.id,
        _id: updatedStudent.id,
        name: updatedStudent.name,
        email: updatedStudent.email,
        phone: updatedStudent.phone,
        roll_no: updatedStudent.roll_no,
      },
    });
  } catch (error) {
    console.error('OTP Verification error:', error);
    return res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
  }
};

// Resend OTP controller
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email or mobile number is required.' });

    const identifier = email.trim();
    let rows;
    if (identifier.includes('@')) {
      [rows] = await pool.execute('SELECT * FROM Student WHERE email = ? LIMIT 1', [identifier.toLowerCase()]);
    } else {
      const cleanPhone = identifier.replace(/\s+/g, '');
      [rows] = await pool.execute('SELECT * FROM Student WHERE phone = ? OR email = ? LIMIT 1', [cleanPhone, identifier.toLowerCase()]);
    }
    const student = rows[0] || null;

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }

    if (student.is_verified) {
      return res.status(400).json({ success: false, message: 'This account is already verified — please log in.' });
    }

    const otpCode = generateOTP();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    await pool.execute(
      'UPDATE Student SET otp_code = ?, otp_expires_at = ? WHERE id = ?',
      [otpCode, expiry, student.id]
    );

    try {
      await sendOTP(student.email, otpCode);
    } catch (err) {
      console.warn('[ResendOTP] Email send warning:', err.message);
    }

    return res.status(200).json({
      success: true,
      message: 'A new verification code has been sent to your registered email.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to resend verification code.' });
  }
};

// Student login controller with account lock after failed attempts
// Supports login with either email OR mobile number
const loginStudent = async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const loginInput = (req.body.email || req.body.identifier || req.body.phone || '').trim();
    const { password } = parseResult.data;

    let rows;
    if (loginInput.includes('@')) {
      const cleanEmail = loginInput.toLowerCase();
      [rows] = await pool.execute('SELECT * FROM Student WHERE email = ? LIMIT 1', [cleanEmail]);
    } else {
      const cleanPhone = loginInput.replace(/\s+/g, '');
      [rows] = await pool.execute('SELECT * FROM Student WHERE phone = ? OR email = ? LIMIT 1', [cleanPhone, loginInput.toLowerCase()]);
    }
    const student = rows[0] || null;

    if (!student) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Check account lockout status
    if (student.locked_until && student.locked_until > new Date()) {
      const minutesRemaining = Math.ceil((student.locked_until - new Date()) / (60 * 1000));
      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked due to repeated failed login attempts. Try again in ${minutesRemaining} minutes.`,
      });
    }

    const isMatch = await bcrypt.compare(password, student.password_hash);
    if (!isMatch) {
      const newAttempts = student.failed_login_attempts + 1;
      let lockedUntil = student.locked_until;
      if (newAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      
      await pool.execute(
        'UPDATE Student SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
        [newAttempts, lockedUntil, student.id]
      );

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
        attempts_left: Math.max(0, 5 - newAttempts),
      });
    }

    // Reset failed login counter on password match
    await pool.execute(
      'UPDATE Student SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [student.id]
    );

    // Check if account is verified
    if (!student.is_verified) {
      const otpCode = generateOTP();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await pool.execute(
        'UPDATE Student SET otp_code = ?, otp_expires_at = ? WHERE id = ?',
        [otpCode, otpExpiresAt, student.id]
      );

      try {
        await sendOTP(student.email, otpCode);
      } catch (err) {
        console.warn('[Login OTP] Email send warning:', err.message);
      }

      return res.status(401).json({
        success: false,
        requires_otp: true,
        email: student.email,
        message: 'Please verify your email before logging in. A verification code has been sent to your email.',
      });
    }

    const { accessToken, refreshToken } = generateTokens(student);

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      accessToken,
      refreshToken,
      student: {
        id: student.id,
        _id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        roll_no: student.roll_no,
      },
    });
  } catch (error) {
    console.error('Student login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// Get profile
const getStudentProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    student: req.user,
  });
};

// Forgot Password Controller (Strictly Email-based)
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const [rows] = await pool.execute(
      'SELECT * FROM Student WHERE email = ? AND is_verified = 1 LIMIT 1',
      [cleanEmail]
    );
    const student = rows[0] || null;

    if (student) {
      const otpCode = generateOTP();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await pool.execute(
        `UPDATE Student SET otp_code = ?, otp_expires_at = ?, reset_token = NULL, reset_token_expires = NULL 
         WHERE id = ?`,
        [otpCode, otpExpiresAt, student.id]
      );

      try {
        await sendForgotPasswordOTP(student.email, otpCode);
      } catch (err) {
        console.warn('[Forgot Password] Email send warning:', err.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email address, a verification OTP code has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing password reset request.' });
  }
};

// Reset Password Controller (Strictly Email-based)
const resetPassword = async (req, res) => {
  try {
    const { email, otp_code, password } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }

    if (!otp_code || typeof otp_code !== 'string' || otp_code.trim().length !== 6) {
      return res.status(400).json({ success: false, message: 'Invalid or missing 6-digit OTP code.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const [rows] = await pool.execute('SELECT * FROM Student WHERE email = ? LIMIT 1', [cleanEmail]);
    const student = rows[0] || null;

    if (!student) {
      return res.status(400).json({
        success: false,
        message: 'No student account found with this email address.',
      });
    }

    if (!student.otp_code || student.otp_code !== otp_code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code.',
      });
    }

    if (!student.otp_expires_at || student.otp_expires_at < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired — please request a new one.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.execute(
      `UPDATE Student SET password_hash = ?, otp_code = NULL, otp_expires_at = NULL, reset_token = NULL, reset_token_expires = NULL, failed_login_attempts = 0, locked_until = NULL 
       WHERE id = ?`,
      [hashedPassword, student.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully — please sign in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Server error resetting password.' });
  }
};

// Change Password Controller (Authenticated via Old Password verification)
const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const changePassword = async (req, res) => {
  try {
    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { oldPassword, newPassword } = parseResult.data;
    const studentId = req.studentId;

    const [rows] = await pool.execute('SELECT * FROM Student WHERE id = ? LIMIT 1', [studentId]);
    const student = rows[0] || null;

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }

    const isMatch = await bcrypt.compare(oldPassword, student.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect old password.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.execute(
      'UPDATE Student SET password_hash = ? WHERE id = ?',
      [hashedPassword, studentId]
    );

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully!',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Server error while changing password.' });
  }
};

// Google OAuth Sign-in / Sign-up for Students (No roll_no required)
const googleAuthStudent = async (req, res) => {
  try {
    const { credential, accessToken } = req.body;

    if (!credential && !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required.',
      });
    }

    let payload = null;

    // Verify token with google-auth-library
    if (credential) {
      try {
        const { OAuth2Client } = require('google-auth-library');
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        const client = new OAuth2Client(googleClientId);
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: googleClientId || undefined,
        });
        payload = ticket.getPayload();
      } catch (clientErr) {
        console.warn('[Google Auth] OAuth2Client verification failed, trying tokeninfo endpoint:', clientErr.message);
        try {
          const fetchRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
          if (fetchRes.ok) {
            payload = await fetchRes.json();
          }
        } catch (fetchErr) {
          console.error('[Google Auth] Tokeninfo fetch failed:', fetchErr.message);
        }
      }
    } else if (accessToken) {
      try {
        const fetchRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (fetchRes.ok) {
          payload = await fetchRes.json();
        } else {
          // Fallback to tokeninfo endpoint
          const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
          if (tokenInfoRes.ok) {
            payload = await tokenInfoRes.json();
          }
        }
      } catch (err) {
        console.error('[Google Auth] Userinfo fetch failed, attempting tokeninfo fallback:', err.message);
        try {
          const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
          if (tokenInfoRes.ok) {
            payload = await tokenInfoRes.json();
          }
        } catch (fbErr) {
          console.error('[Google Auth] Tokeninfo fallback failed:', fbErr.message);
        }
      }
    }

    if (!payload || !payload.email) {
      return res.status(401).json({
        success: false,
        message: 'Google authentication failed. Invalid token received from Google.',
      });
    }

    const email = payload.email.toLowerCase().trim();
    const name = payload.name || payload.given_name || email.split('@')[0];
    const googleId = payload.sub || null;
    const avatarUrl = payload.picture || null;

    // Check if a student already exists with this email
    const [rows] = await pool.execute('SELECT * FROM Student WHERE email = ? LIMIT 1', [email]);
    let student = rows[0] || null;

    if (student) {
      // If account is inactive
      if (student.is_active === 0) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact the canteen administrator.',
        });
      }

      // Update avatar_url & google_id, and ensure is_verified = 1
      await pool.execute(
        'UPDATE Student SET is_verified = 1, avatar_url = COALESCE(?, avatar_url), google_id = COALESCE(?, google_id), failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
        [avatarUrl, googleId, student.id]
      );

      const [updatedRows] = await pool.execute('SELECT * FROM Student WHERE id = ? LIMIT 1', [student.id]);
      student = updatedRows[0];
    } else {
      // New Student Signup via Google (Instant 1-tap, no roll_no required)
      const [result] = await pool.execute(
        `INSERT INTO Student (name, email, avatar_url, google_id, is_verified, is_active, failed_login_attempts)
         VALUES (?, ?, ?, ?, 1, 1, 0)`,
        [name.trim(), email, avatarUrl, googleId]
      );

      const [newRows] = await pool.execute('SELECT * FROM Student WHERE id = ? LIMIT 1', [result.insertId]);
      student = newRows[0];
    }

    const { accessToken: jwtAccessToken, refreshToken: jwtRefreshToken } = generateTokens(student);

    return res.status(200).json({
      success: true,
      message: `Welcome, ${student.name}!`,
      accessToken: jwtAccessToken,
      refreshToken: jwtRefreshToken,
      student: {
        id: student.id,
        _id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone || null,
        roll_no: student.roll_no || null,
        avatar_url: student.avatar_url || avatarUrl || null,
      },
    });
  } catch (error) {
    console.error('Google Student Auth Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during Google authentication.',
    });
  }
};

module.exports = {
  registerStudent,
  verifyOTP,
  resendOTP,
  loginStudent,
  googleAuthStudent,
  getStudentProfile,
  forgotPassword,
  resetPassword,
  changePassword,
};
