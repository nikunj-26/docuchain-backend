const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const documentsController = require("../controllers/documentsController");

const router = express.Router();

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

/**
 * GET /documents
 * Get all documents for authenticated user
 * Requires: JWT token
 */
router.get(
  "/documents",
  authMiddleware,
  documentsController.getDocuments,
);

/**
 * GET /documents/:id
 * Get a single document with all its versions
 * Requires: JWT token, document ownership
 */
router.get(
  "/documents/:id",
  authMiddleware,
  documentsController.getDocumentById,
);

/**
 * POST /documents
 * Create a new document
 * Requires: JWT token, PDF file
 */
router.post(
  "/documents",
  authMiddleware,
  upload.single("file"),
  documentsController.createDocument,
);

/**
 * POST /documents/:id/version
 * Add a new version to an existing document
 * Requires: JWT token, PDF file, document ownership
 */
router.post(
  "/documents/:id/version",
  authMiddleware,
  upload.single("file"),
  documentsController.addVersion,
);

/**
 * GET /documents/:id/version/:version/view
 * View a specific document version inline
 * Requires: JWT token, document ownership
 */
router.get(
  "/documents/:id/version/:version/view",
  authMiddleware,
  documentsController.viewDocumentVersion,
);

module.exports = router;
