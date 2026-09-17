const express = require('express');
const router = express.Router();
const {
  createInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
  restockInventoryItem,
  getInventoryItemLogs,
  getInventoryDashboardSummary,
  getMenuStock,
  toggleMenuStockTracking,
  updateMenuItemStock,
  batchUpdateMenuStock,
} = require('../controllers/inventoryController');
const { verifyAdmin } = require('../middleware/authMiddleware');

// All inventory endpoints require Admin verification (staff/super_admin)
router.use(verifyAdmin);

// Menu Portions Stock Management endpoints
router.get('/menu-stock', getMenuStock);
router.put('/menu-stock/toggle', toggleMenuStockTracking);
router.post('/menu-stock/toggle', toggleMenuStockTracking);
router.put('/menu-stock/batch', batchUpdateMenuStock);
router.post('/menu-stock/batch', batchUpdateMenuStock);
router.put('/menu-stock/:id', updateMenuItemStock);
router.post('/menu-stock/:id', updateMenuItemStock);

// Dashboard summary endpoint
router.get('/summary', getInventoryDashboardSummary);

// Base CRUD endpoints
router.get('/', listInventoryItems);
router.post('/', createInventoryItem);
router.put('/:id', updateInventoryItem);
router.delete('/:id', deleteInventoryItem);

// Restock & Logs endpoints
router.post('/:id/restock', restockInventoryItem);
router.get('/:id/logs', getInventoryItemLogs);

module.exports = router;
