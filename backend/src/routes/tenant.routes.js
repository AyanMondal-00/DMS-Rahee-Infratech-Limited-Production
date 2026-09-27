const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenant.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Admin authorization guard for tenant organization management
const requireAdminOrManageUsers = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  const userRole = (req.user.role_name || '').toUpperCase();
  const isAdmin = req.user.is_super_admin || 
                  [1, 2, 8].includes(req.user.role_id) || 
                  userRole.includes('ADMIN') || 
                  (req.user.permissions || []).includes('manage_users');
  
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Only System and Company Administrators can manage tenant organizations.'
    });
  }
  next();
};

router.use(authenticateToken);

router.get('/', tenantController.getOrganizations);
router.post('/', requireAdminOrManageUsers, tenantController.createOrganization);
router.patch('/:id/status', requireAdminOrManageUsers, tenantController.updateOrganizationStatus);

module.exports = router;
