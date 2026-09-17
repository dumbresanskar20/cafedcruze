const rateLimit = require('express-rate-limit');

// Helper to reliably extract client IP behind cPanel Passenger / Cloudflare / reverse proxy
const getClientIp = (req) => {
  return (
    req.headers['cf-connecting-ip'] ||
    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) ||
    req.ip ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
};

// Common configuration for all rate limiters to prevent proxy validation crashes on cPanel
const commonOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable permissive trust proxy validation crashes in express-rate-limit v7+
  skip: (req) => req.method === 'OPTIONS', // Never rate-limit CORS preflight checks
};

const authLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  keyGenerator: (req) => getClientIp(req),
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
});

// General API rate limiter (generous limit for campus Wi-Fi / NAT shared IPs)
const apiLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 1000, // Default 1000 requests per 15 min
  keyGenerator: (req) => getClientIp(req),
  message: {
    success: false,
    message: 'Too many API requests from this IP, please try again later.',
  },
});

// Forgot password rate limiter (3 requests per hour max, keyed by email)
const forgotPasswordLimiter = rateLimit({
  ...commonOptions,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit to 3 requests per hour
  keyGenerator: (req) => {
    return req.body?.email ? req.body.email.toLowerCase().trim() : getClientIp(req);
  },
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again after an hour.',
  },
});

// Resend OTP rate limiter (3 requests per 15 minutes max, keyed by email)
const resendOtpLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit to 3 requests per 15 minutes
  keyGenerator: (req) => {
    return req.body?.email ? req.body.email.toLowerCase().trim() : getClientIp(req);
  },
  message: {
    success: false,
    message: 'Too many OTP resend attempts. Please try again after 15 minutes.',
  },
});

// Stricter rate limiter for owner endpoints
const ownerLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Limit each IP to 60 requests per 15 minutes
  keyGenerator: (req) => getClientIp(req),
  message: {
    success: false,
    message: 'Too many developer panel attempts, please try again after 15 minutes.',
  },
});

module.exports = {
  authLimiter,
  apiLimiter,
  forgotPasswordLimiter,
  resendOtpLimiter,
  ownerLimiter,
  getClientIp,
};


