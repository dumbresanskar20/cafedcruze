const express = require('express');
const router = express.Router();
const {
  registerStudent,
  verifyOTP,
  resendOTP,
  loginStudent,
  googleAuthStudent,
  getStudentProfile,
  forgotPassword,
  resetPassword,
  changePassword,
  getStudentAddresses,
  addStudentAddress,
  deleteStudentAddress,
  setDefaultAddress,
} = require('../controllers/studentAuthController');
const { verifyStudent } = require('../middleware/authMiddleware');
const { authLimiter, forgotPasswordLimiter, resendOtpLimiter } = require('../middleware/rateLimiter');

// Rate limited public auth routes
router.post('/signup', authLimiter, registerStudent);
router.post('/google', authLimiter, googleAuthStudent);
router.post('/verify-otp', authLimiter, verifyOTP);
router.post('/resend-otp', resendOtpLimiter, resendOTP);
router.post('/login', authLimiter, loginStudent);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

// Authenticated student routes
router.get('/me', verifyStudent, getStudentProfile);
router.post('/change-password', verifyStudent, changePassword);

// Student delivery address management (for parcel/takeaway orders)
router.get('/addresses', verifyStudent, getStudentAddresses);
router.post('/addresses', verifyStudent, addStudentAddress);
router.delete('/addresses/:id', verifyStudent, deleteStudentAddress);
router.put('/addresses/:id/default', verifyStudent, setDefaultAddress);

module.exports = router;
