const express = require('express');
const router = express.Router();
const recycleBinController = require('../controllers/recycleBin.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// Get all deleted items (Folders and Documents)
router.get('/items', recycleBinController.getDeletedItems);

// Restore Folder & its contents
router.post('/restore/folder/:id', recycleBinController.restoreFolder);

// Restore Document
router.post('/restore/document/:id', recycleBinController.restoreDocument);

// Restore All
router.post('/restore-all', recycleBinController.restoreAll);

// Permanent Delete Folder
router.delete('/permanent/folder/:id', recycleBinController.permanentDeleteFolder);

// Permanent Delete Document
router.delete('/permanent/document/:id', recycleBinController.permanentDeleteDocument);

// Empty Entire Recycle Bin
router.delete('/empty', recycleBinController.emptyRecycleBin);

module.exports = router;
