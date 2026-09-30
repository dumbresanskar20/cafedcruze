const express = require('express');
const router = express.Router();
const {
  submitOrderRating,
  getOrderRatings,
  getMealWiseReviewsSummary,
  getPublicMenuRatings,
} = require('../controllers/reviewController');
const { verifyStudent, verifyAdmin } = require('../middleware/authMiddleware');

// Student Rating endpoints
router.post('/rate-order', verifyStudent, submitOrderRating);
router.get('/order/:order_id', verifyStudent, getOrderRatings);

// Public Menu item ratings
router.get('/menu-ratings', getPublicMenuRatings);

// Admin analytics endpoint
router.get('/admin/summary', verifyAdmin, getMealWiseReviewsSummary);

module.exports = router;
