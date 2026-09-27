const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.use(authenticateToken);

router.get('/dashboard', reportController.getDashboardMetrics);
router.get('/dashboard-metrics', reportController.getDashboardMetrics);
router.get('/metrics', reportController.getDashboardMetrics);

module.exports = router;
