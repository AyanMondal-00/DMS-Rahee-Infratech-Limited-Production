const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permission.middleware');

router.use(authenticateToken);

router.get('/', userController.getUsers);
router.get('/roles', userController.getRoles);
router.post('/', requirePermission('manage_users'), userController.createUser);
router.patch('/:id/status', requirePermission('manage_users'), userController.updateUserStatus);
router.put('/:id/reset-password', requirePermission('manage_users'), userController.resetUserPassword);
router.delete('/:id', requirePermission('manage_users'), userController.deleteUser);

module.exports = router;
