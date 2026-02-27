const { PinataSDK } = require("pinata");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const pinataJwt = process.env.PINATA_JWT;
const pinataGateway = process.env.PINATA_GATEWAY;

// Validate Pinata configuration
if (!pinataJwt || !pinataGateway) {
  logger.warn(
    "Pinata JWT or Gateway not configured. IPFS uploads will fail.",
  );
}

let pinata = null;

try {
  pinata = new PinataSDK({
    pinataJwt,
    pinataGateway,
  });
} catch (error) {
  logger.error("Failed to initialize Pinata SDK:", {
    message: error.message,
  });
}

/**
 * Upload a file to IPFS via Pinata
 * @param {Buffer|string} fileContent - File content (buffer or file path)
 * @param {string} fileName - File name (should include extension)
 * @param {object} metadata - Optional metadata to attach
 * @returns {Promise<object>} Object with cid and file info
 */
const uploadFile = async (fileContent, fileName, metadata = {}) => {
  try {
    if (!pinata) {
      throw new Error(
        "Pinata SDK not initialized. Check PINATA_JWT and PINATA_GATEWAY in .env",
      );
    }

    // Validate file name
    if (!fileName) {
      throw new Error("File name is required");
    }

    // Handle file path input
    let fileBuffer;
    if (typeof fileContent === "string") {
      if (!fs.existsSync(fileContent)) {
        throw new Error(`File not found: ${fileContent}`);
      }
      fileBuffer = fs.readFileSync(fileContent);
      // Use provided fileName or extract from path
      fileName = fileName || path.basename(fileContent);
    } else if (Buffer.isBuffer(fileContent)) {
      fileBuffer = fileContent;
    } else {
      throw new Error(
        "File content must be a Buffer or file path string",
      );
    }

    // Validate file extension (PDF)
    const ext = path.extname(fileName).toLowerCase();
    if (ext !== ".pdf") {
      throw new Error(
        `Invalid file type: ${ext}. Only PDF files are supported.`,
      );
    }

    // Create File object for Pinata SDK
    const file = new File([fileBuffer], fileName, {
      type: "application/pdf",
    });

    // Upload to Pinata using the correct method
    const upload = await pinata.upload.public.file(file);

    logger.debug(
      `File uploaded to IPFS: ${fileName} (CID: ${upload.cid})`,
    );

    return {
      cid: upload.cid,
      fileName: upload.name,
      size: upload.size,
      mimeType: upload.mime_type,
      uploadId: upload.id,
      createdAt: upload.created_at,
      gateway: `https://${pinataGateway}/ipfs/${upload.cid}`,
    };
  } catch (error) {
    logger.error("Pinata upload error:", { message: error.message });
    throw {
      status: 400,
      message: "Failed to upload file to IPFS",
      error: error.message,
    };
  }
};

/**
 * Get the gateway URL for a CID
 * @param {string} cid - IPFS content identifier
 * @returns {string} Gateway URL
 */
const getGatewayUrl = (cid) => {
  if (!cid || !pinataGateway) {
    throw new Error("Invalid CID or Pinata gateway not configured");
  }
  return `https://${pinataGateway}/ipfs/${cid}`;
};

module.exports = {
  uploadFile,
  getGatewayUrl,
  pinata,
};
