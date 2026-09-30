const express = require('express');
const router = express.Router();
const {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMealWindows,
  updateMealWindow,
  createMealType,
  renameMealType,
  getMenuItemRecipe,
} = require('../controllers/menuController');
const { verifyAdmin } = require('../middleware/authMiddleware');
const { handleImageUpload } = require('../middleware/upload');

// Public endpoints
router.get('/items', getMenuItems);
router.get('/admin/menu-items', getMenuItems);
router.get('/windows', getMealWindows);
router.get('/types', getMealWindows);

// Admin-only endpoints for menu items with local disk image upload middleware
router.post('/items', verifyAdmin, handleImageUpload('image'), createMenuItem);
router.post('/admin/menu-items', verifyAdmin, handleImageUpload('image'), createMenuItem);
router.put('/items/:id', verifyAdmin, handleImageUpload('image'), updateMenuItem);
router.patch('/items/:id', verifyAdmin, handleImageUpload('image'), updateMenuItem);
router.put('/admin/menu-items/:id', verifyAdmin, handleImageUpload('image'), updateMenuItem);
router.patch('/admin/menu-items/:id', verifyAdmin, handleImageUpload('image'), updateMenuItem);
router.delete('/items/:id', verifyAdmin, deleteMenuItem);
router.delete('/admin/menu-items/:id', verifyAdmin, deleteMenuItem);
router.get('/items/:id/recipe', verifyAdmin, getMenuItemRecipe);
router.get('/admin/menu-items/:id/recipe', verifyAdmin, getMenuItemRecipe);

// Admin-only endpoints for meal timings & dynamic meal types
router.put('/windows/:meal_type/rename', verifyAdmin, renameMealType);
router.put('/windows/:meal_type', verifyAdmin, updateMealWindow);
router.post('/windows', verifyAdmin, createMealType);
router.put('/meal-types/:meal_type/rename', verifyAdmin, renameMealType);
router.post('/meal-types', verifyAdmin, createMealType);

module.exports = router;
