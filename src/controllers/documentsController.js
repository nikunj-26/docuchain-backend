const pinataService = require("../services/pinataService");
const blockchainService = require("../services/blockchainService");
const { generateSHA256 } = require("../utils/hash");
const {
  encryptFile,
  decryptFile,
} = require("../utils/fileEncryption");
const database = require("../config/database");

/**
 * Create a new document with IPFS and blockchain storage
 * POST /documents
 *
 * Flow:
 * 1. Validate JWT (via middleware)
 * 2. Accept PDF file (via multer)
 * 3. Validate file (exists, MIME type, size)
 * 4. Generate SHA256 hash of original file
 * 5. Encrypt file
 * 6. Upload encrypted file to Pinata
 * 7. Create document on blockchain
 * 8. Insert into database (transaction)
 * 9. Return response
 */
const createDocument = async (req, res, next) => {
  let client = null;
  const userId = req.user.id;

  try {
    // Step 1: Validate request body
    const { title } = req.body;

    if (!title || title.trim() === "") {
      return res.status(400).json({
        error: "Document title is required",
      });
    }

    // Step 2: Validate file exists
    if (!req.file) {
      return res.status(400).json({
        error: "PDF file is required",
      });
    }

    // Step 3: Validate MIME type
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({
        error: "File must be a PDF",
      });
    }

    // Step 4: Validate file size (20MB limit)
    const maxSize = 20 * 1024 * 1024; // 20MB in bytes
    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: "File size exceeds 20MB limit",
      });
    }

    console.log(
      `Creating document: "${title}" (${req.file.size} bytes)`,
    );

    // Fetch user from database to get wallet address
    const userResult = await database.query(
      "SELECT id, wallet_address FROM users WHERE id = $1",
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const userWalletAddress = userResult.rows[0].wallet_address;

    if (!userWalletAddress) {
      return res.status(400).json({
        error: "User must have a wallet address to create documents",
      });
    }

    // Step 5: Generate SHA256 hash of original file
    const fileHash = generateSHA256(req.file.buffer);
    console.log(`  File hash: ${fileHash}`);

    // Step 6: Encrypt file
    console.log("  Encrypting file...");
    const { encryptedFileBuffer, encryptedKeyPayload } =
      await encryptFile(req.file.buffer);

    // Step 7: Upload encrypted file to Pinata
    console.log("  Uploading to IPFS...");
    const pinataResult = await pinataService.uploadFile(
      encryptedFileBuffer,
      req.file.originalname,
      { userId, title },
    );
    const cid = pinataResult.cid;
    console.log(`  CID: ${cid}`);

    // Step 8: Create document on blockchain
    console.log("  Creating on blockchain...");
    const blockchainResult = await blockchainService.createDocument(
      userWalletAddress,
      title,
      cid,
      fileHash,
    );

    if (!blockchainResult.documentId) {
      throw new Error(
        "Failed to extract document ID from blockchain transaction",
      );
    }

    const blockchainDocumentId = parseInt(
      blockchainResult.documentId,
    );
    const txHash = blockchainResult.txHash;
    console.log(`  Blockchain doc ID: ${blockchainDocumentId}`);
    console.log(`  Transaction: ${txHash}`);

    // Step 9: DATABASE TRANSACTION
    // Only commit after blockchain confirmation
    client = await database.getClient();

    try {
      await client.query("BEGIN");

      // Insert into documents table
      const docResult = await client.query(
        `INSERT INTO documents (user_id, blockchain_document_id, title)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [userId, blockchainDocumentId, title],
      );

      const documentId = docResult.rows[0].id;

      // Insert into document_versions table
      await client.query(
        `INSERT INTO document_versions (document_id, version_number, ipfs_cid, file_hash, blockchain_tx_hash, encrypted_key_payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [documentId, 1, cid, fileHash, txHash, encryptedKeyPayload],
      );

      await client.query("COMMIT");

      console.log(`✓ Document created successfully`);

      res.status(201).json({
        documentId,
        blockchainDocumentId,
        version: 1,
        txHash,
      });
    } catch (dbError) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError.message);
      }
      throw dbError;
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error) {
    console.error("Create document error:", error.message);

    // Determine appropriate status code
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
      });
    }

    res.status(500).json({
      error: "Failed to create document",
    });
  }
};

/**
 * Add a new version to an existing document
 * POST /documents/:id/version
 *
 * Flow:
 * 1. Validate JWT (via middleware)
 * 2. Extract document UUID from params
 * 3. Validate document exists and belongs to user
 * 4. Accept PDF file (via multer)
 * 5. Validate file (exists, MIME type, size)
 * 6. Generate SHA256 hash of original file
 * 7. Encrypt file
 * 8. Upload encrypted file to Pinata
 * 9. Add version on blockchain
 * 10. Insert into database (transaction)
 * 11. Return response
 */
const addVersion = async (req, res, next) => {
  let client = null;
  const userId = req.user.id;
  const documentId = req.params.id;

  try {
    // Step 1: Validate document UUID format
    if (
      !documentId ||
      !documentId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return res.status(400).json({
        error: "Invalid document ID format",
      });
    }

    // Step 2: Check if document exists and belongs to user
    const docResult = await database.query(
      "SELECT id, user_id, blockchain_document_id, title FROM documents WHERE id = $1",
      [documentId],
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        error: "Document not found",
      });
    }

    const document = docResult.rows[0];

    if (document.user_id !== userId) {
      return res.status(403).json({
        error: "You do not have permission to modify this document",
      });
    }

    const blockchainDocumentId = document.blockchain_document_id;

    // Step 3: Validate file exists
    if (!req.file) {
      return res.status(400).json({
        error: "PDF file is required",
      });
    }

    // Step 4: Validate MIME type
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({
        error: "File must be a PDF",
      });
    }

    // Step 5: Validate file size (20MB limit)
    const maxSize = 20 * 1024 * 1024; // 20MB in bytes
    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: "File size exceeds 20MB limit",
      });
    }

    console.log(
      `Adding version to document: "${document.title}" (${req.file.size} bytes)`,
    );

    // Step 6: Generate SHA256 hash of original file
    const fileHash = generateSHA256(req.file.buffer);
    console.log(`  File hash: ${fileHash}`);

    // Step 7: Encrypt file
    console.log("  Encrypting file...");
    const { encryptedFileBuffer, encryptedKeyPayload } =
      await encryptFile(req.file.buffer);

    // Step 8: Upload encrypted file to Pinata
    console.log("  Uploading to IPFS...");
    const pinataResult = await pinataService.uploadFile(
      encryptedFileBuffer,
      req.file.originalname,
      { userId, documentId, title: document.title },
    );
    const cid = pinataResult.cid;
    console.log(`  CID: ${cid}`);

    // Step 9: Add version on blockchain
    console.log("  Adding version on blockchain...");
    const blockchainResult = await blockchainService.addVersion(
      blockchainDocumentId,
      cid,
      fileHash,
    );

    const txHash = blockchainResult.txHash;
    console.log(`  Transaction: ${txHash}`);

    // Step 10: DATABASE TRANSACTION
    // Only commit after blockchain confirmation
    client = await database.getClient();

    try {
      await client.query("BEGIN");

      // Get current highest version number
      const versionResult = await client.query(
        "SELECT COALESCE(MAX(version_number), 0) as max_version FROM document_versions WHERE document_id = $1",
        [documentId],
      );

      const nextVersion = versionResult.rows[0].max_version + 1;

      // Insert new version
      await client.query(
        `INSERT INTO document_versions (document_id, version_number, ipfs_cid, file_hash, blockchain_tx_hash, encrypted_key_payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          documentId,
          nextVersion,
          cid,
          fileHash,
          txHash,
          encryptedKeyPayload,
        ],
      );

      await client.query("COMMIT");

      console.log(`✓ Version ${nextVersion} added successfully`);

      res.status(201).json({
        documentId,
        version: nextVersion,
        txHash,
      });
    } catch (dbError) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError.message);
      }
      throw dbError;
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error) {
    console.error("Add version error:", error.message);

    // Determine appropriate status code
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
      });
    }

    res.status(500).json({
      error: "Failed to add version",
    });
  }
};

/**
 * Get all documents for the authenticated user
 * GET /documents
 *
 * Returns:
 * - id
 * - title
 * - version_count
 * - created_at
 */
const getDocuments = async (req, res, next) => {
  const userId = req.user.id;

  try {
    const result = await database.query(
      `SELECT
        d.id,
        d.title,
        d.created_at,
        COUNT(dv.id) as version_count
      FROM documents d
      LEFT JOIN document_versions dv ON d.id = dv.document_id
      WHERE d.user_id = $1
      GROUP BY d.id, d.title, d.created_at
      ORDER BY d.created_at DESC`,
      [userId],
    );

    res.status(200).json({
      documents: result.rows,
    });
  } catch (error) {
    console.error("Get documents error:", error.message);
    res.status(500).json({
      error: "Failed to retrieve documents",
    });
  }
};

/**
 * Get a single document by ID with all its versions
 * GET /documents/:id
 *
 * Returns:
 * - Document metadata
 * - All versions ordered by version_number
 */
const getDocumentById = async (req, res, next) => {
  const userId = req.user.id;
  const documentId = req.params.id;

  try {
    // Validate document UUID format
    if (
      !documentId ||
      !documentId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return res.status(400).json({
        error: "Invalid document ID format",
      });
    }

    // Fetch document metadata
    const docResult = await database.query(
      `SELECT id, title, blockchain_document_id, created_at
       FROM documents
       WHERE id = $1`,
      [documentId],
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        error: "Document not found",
      });
    }

    const document = docResult.rows[0];

    // Check if user owns the document
    const ownerCheck = await database.query(
      "SELECT user_id FROM documents WHERE id = $1",
      [documentId],
    );

    if (ownerCheck.rows[0].user_id !== userId) {
      return res.status(403).json({
        error: "You do not have permission to access this document",
      });
    }

    // Fetch all versions
    const versionsResult = await database.query(
      `SELECT
        version_number,
        ipfs_cid,
        file_hash,
        blockchain_tx_hash,
        created_at
       FROM document_versions
       WHERE document_id = $1
       ORDER BY version_number ASC`,
      [documentId],
    );

    // Format response
    res.status(200).json({
      id: document.id,
      title: document.title,
      blockchainDocumentId: document.blockchain_document_id,
      createdAt: document.created_at,
      versions: versionsResult.rows.map((v) => ({
        versionNumber: v.version_number,
        ipfsCid: v.ipfs_cid,
        fileHash: v.file_hash,
        txHash: v.blockchain_tx_hash,
        createdAt: v.created_at,
      })),
    });
  } catch (error) {
    console.error("Get document by ID error:", error.message);
    res.status(500).json({
      error: "Failed to retrieve document",
    });
  }
};

/**
 * View a specific document version inline
 * GET /documents/:id/version/:version/view
 *
 * Retrieves and decrypts a specific version of a document for inline viewing.
 * Returns the decrypted PDF directly.
 */
const viewDocumentVersion = async (req, res, next) => {
  const userId = req.user.id;
  const documentId = req.params.id;
  const versionNumber = parseInt(req.params.version, 10);

  try {
    // Validate document UUID format
    if (
      !documentId ||
      !documentId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return res.status(400).json({
        error: "Invalid document ID format",
      });
    }

    // Validate version number
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return res.status(400).json({
        error: "Invalid version number",
      });
    }

    // Check if user owns the document
    const docOwnerCheck = await database.query(
      "SELECT user_id FROM documents WHERE id = $1",
      [documentId],
    );

    if (docOwnerCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Document not found",
      });
    }

    if (docOwnerCheck.rows[0].user_id !== userId) {
      return res.status(403).json({
        error: "You do not have permission to access this document",
      });
    }

    // Fetch version record
    const versionResult = await database.query(
      `SELECT ipfs_cid, encrypted_key_payload FROM document_versions
       WHERE document_id = $1 AND version_number = $2`,
      [documentId, versionNumber],
    );

    if (versionResult.rows.length === 0) {
      return res.status(404).json({
        error: "Version not found",
      });
    }

    const { ipfs_cid, encrypted_key_payload } = versionResult.rows[0];

    // Retrieve encrypted file from IPFS
    console.log(
      `Retrieving version ${versionNumber} from IPFS (CID: ${ipfs_cid.substring(0, 10)}...)`,
    );

    const PINATA_GATEWAY = process.env.PINATA_GATEWAY;
    if (!PINATA_GATEWAY) {
      throw new Error("PINATA_GATEWAY not configured");
    }

    const ipfsUrl = `https://${PINATA_GATEWAY}/ipfs/${ipfs_cid}`;

    let encryptedFileBuffer;
    try {
      const response = await fetch(ipfsUrl, {
        timeout: 30000,
      });
      if (!response.ok) {
        throw new Error(`IPFS fetch failed: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      encryptedFileBuffer = Buffer.from(arrayBuffer);
    } catch (error) {
      console.error(
        "Failed to retrieve file from IPFS:",
        error.message,
      );
      return res.status(500).json({
        error: "Failed to retrieve document from storage",
      });
    }

    // Decrypt file
    console.log("Decrypting document...");
    let decryptedBuffer;
    try {
      decryptedBuffer = await decryptFile(
        encryptedFileBuffer,
        encrypted_key_payload,
      );
    } catch (error) {
      console.error("Decryption failed:", error.message);
      return res.status(500).json({
        error: "Failed to decrypt document",
      });
    }

    // Send decrypted PDF for inline viewing
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );
    res.send(decryptedBuffer);
  } catch (error) {
    console.error("View document version error:", error.message);
    res.status(500).json({
      error: "Failed to retrieve document",
    });
  }
};

module.exports = {
  createDocument,
  addVersion,
  getDocuments,
  getDocumentById,
  viewDocumentVersion,
};
