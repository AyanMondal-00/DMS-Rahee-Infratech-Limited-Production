const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const reviewController = require('../controllers/review.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { enforceTenantIsolation } = require('../middleware/tenant.middleware');
const { requirePermission } = require('../middleware/permission.middleware');
const { upload } = require('../config/storage');

router.use(authenticateToken);
router.use(enforceTenantIsolation);

// Helper middleware to handle multer file upload validation errors gracefully
const handleUpload = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload validation failed.'
      });
    }
    next();
  });
};

// Document upload & list
router.get('/', documentController.getDocuments);
router.post('/', requirePermission('upload'), handleUpload(upload.any()), documentController.uploadDocument);

// Document detail, preview, download
router.get('/:id', documentController.getDocumentById);
router.get('/:id/preview', requirePermission('preview'), documentController.previewDocument);
router.get('/:id/download', requirePermission('download'), documentController.downloadDocument);

// Revision upload (V1.1, V1.2)
router.post('/:id/versions', requirePermission('edit'), handleUpload(upload.single('file')), documentController.uploadNewVersion);

// Workflow Review & Approval Action
router.post('/:id/review', requirePermission('approve_reject', 'final_approve'), reviewController.processReviewAction);

// Archival Policy Manual / Scheduled Trigger (Admin / System)
router.post('/run-archival-policy', documentController.triggerArchivalPolicy);

// Manual Document Archival (Super Admin & Company Admins)
router.post('/:id/archive', documentController.archiveDocument);

// Document Restoration / Retention Recovery from Archive
router.post('/:id/restore', documentController.restoreDocument);

// Document Deletion (Super Admin ONLY)
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
