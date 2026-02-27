const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

// Load contract ABI
const abiPath = path.join(
  __dirname,
  "../../abi/VersionedDocuments.json",
);
const contractABI = JSON.parse(fs.readFileSync(abiPath, "utf8"));

// Load configuration from environment
const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;

// Validate configuration
if (!rpcUrl || !privateKey || !contractAddress) {
  logger.warn(
    "Blockchain configuration incomplete. Smart contract operations will fail.",
  );
  logger.warn("Required: RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS");
}

let provider = null;
let wallet = null;
let contract = null;

try {
  if (rpcUrl && privateKey && contractAddress) {
    provider = new ethers.JsonRpcProvider(rpcUrl);
    wallet = new ethers.Wallet(privateKey, provider);
    contract = new ethers.Contract(
      contractAddress,
      contractABI,
      wallet,
    );
  }
} catch (error) {
  logger.error("Failed to initialize blockchain service:", {
    message: error.message,
  });
}

/**
 * Create a new document on the blockchain
 * @param {string} owner - Owner wallet address
 * @param {string} title - Document title
 * @param {string} cid - IPFS CID
 * @param {string} fileHash - File hash (should be bytes32)
 * @returns {Promise<object>} Transaction hash, documentId, and other details
 */
const createDocument = async (owner, title, cid, fileHash) => {
  try {
    if (!contract) {
      throw new Error(
        "Blockchain service not initialized. Check RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS in .env",
      );
    }

    // Validate inputs
    if (!ethers.isAddress(owner)) {
      throw new Error("Invalid owner address");
    }

    if (!title || title.trim() === "") {
      throw new Error("Title cannot be empty");
    }

    if (!cid || cid.trim() === "") {
      throw new Error("CID cannot be empty");
    }

    if (!fileHash) {
      throw new Error("File hash is required");
    }

    // Convert fileHash to bytes32 if it's a string
    let hash = fileHash;
    if (typeof fileHash === "string") {
      if (!fileHash.startsWith("0x")) {
        // Convert hex string to bytes32
        hash = ethers.zeroPadValue(
          "0x" + fileHash.replace(/^0x/, ""),
          32,
        );
      } else {
        hash = ethers.zeroPadValue(fileHash, 32);
      }
    }

    logger.debug("Creating document on blockchain...");
    logger.debug(`  Owner: ${owner}`);
    logger.debug(`  Title: ${title}`);
    logger.debug(`  CID: ${cid}`);

    // Send transaction
    const tx = await contract.createDocument(owner, title, cid, hash);
    logger.debug(`  Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    logger.debug("  Waiting for confirmation...");
    const receipt = await tx.wait();

    if (!receipt || receipt.status === 0) {
      throw new Error("Transaction failed");
    }

    logger.info("Document created successfully");
    logger.debug(`  Block: ${receipt.blockNumber}`);
    logger.debug(`  Gas used: ${receipt.gasUsed.toString()}`);

    // Parse DocumentCreated event from logs
    let documentId = null;
    const documentCreatedEvent = contract.interface.parseLog({
      topics: receipt.logs[0]?.topics || [],
      data: receipt.logs[0]?.data || "0x",
    });

    if (
      documentCreatedEvent &&
      documentCreatedEvent.name === "DocumentCreated"
    ) {
      documentId = documentCreatedEvent.args.documentId.toString();
      logger.debug(`  Document ID: ${documentId}`);
    }

    return {
      txHash: tx.hash,
      documentId,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 1 ? "success" : "failed",
    };
  } catch (error) {
    logger.error("Create document error:", {
      message: error.message,
    });
    throw {
      status: 400,
      message: "Failed to create document on blockchain",
      error: error.message,
    };
  }
};

/**
 * Add a new version to an existing document
 * @param {number} documentId - Document ID
 * @param {string} cid - IPFS CID
 * @param {string} fileHash - File hash (should be bytes32)
 * @returns {Promise<object>} Transaction hash and other details
 */
const addVersion = async (documentId, cid, fileHash) => {
  try {
    if (!contract) {
      throw new Error(
        "Blockchain service not initialized. Check RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS in .env",
      );
    }

    // Validate inputs
    if (!documentId || documentId <= 0) {
      throw new Error("Invalid document ID");
    }

    if (!cid || cid.trim() === "") {
      throw new Error("CID cannot be empty");
    }

    if (!fileHash) {
      throw new Error("File hash is required");
    }

    // Convert fileHash to bytes32 if it's a string
    let hash = fileHash;
    if (typeof fileHash === "string") {
      if (!fileHash.startsWith("0x")) {
        hash = ethers.zeroPadValue(
          "0x" + fileHash.replace(/^0x/, ""),
          32,
        );
      } else {
        hash = ethers.zeroPadValue(fileHash, 32);
      }
    }

    logger.debug("Adding version to document on blockchain...");
    logger.debug(`  Document ID: ${documentId}`);
    logger.debug(`  CID: ${cid}`);

    // Send transaction
    const tx = await contract.addVersion(documentId, cid, hash);
    logger.debug(`  Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    logger.debug("  Waiting for confirmation...");
    const receipt = await tx.wait();

    if (!receipt || receipt.status === 0) {
      throw new Error("Transaction failed");
    }

    logger.info("Version added successfully");
    logger.debug(`  Block: ${receipt.blockNumber}`);
    logger.debug(`  Gas used: ${receipt.gasUsed.toString()}`);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 1 ? "success" : "failed",
    };
  } catch (error) {
    logger.error("Add version error:", { message: error.message });
    throw {
      status: 400,
      message: "Failed to add version on blockchain",
      error: error.message,
    };
  }
};

/**
 * Get document information (read-only)
 * @param {number} documentId - Document ID
 * @returns {Promise<object>} Document owner, title, and version count
 */
const getDocument = async (documentId) => {
  try {
    if (!contract) {
      throw new Error("Blockchain service not initialized");
    }

    const doc = await contract.getDocument(documentId);

    return {
      owner: doc.owner,
      title: doc.title,
      versionCount: doc.versionCount.toString(),
    };
  } catch (error) {
    logger.error("Get document error:", { message: error.message });
    throw {
      status: 400,
      message: "Failed to get document from blockchain",
      error: error.message,
    };
  }
};

/**
 * Verify blockchain connection and contract accessibility
 * @returns {Promise<void>}
 */
const verifyBlockchainConnection = async () => {
  try {
    if (!rpcUrl || !privateKey || !contractAddress) {
      logger.error("Blockchain configuration incomplete");
      logger.error(
        "Required: RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS",
      );
      process.exit(1);
    }

    // Initialize provider, wallet, and contract
    const testProvider = new ethers.JsonRpcProvider(rpcUrl);
    const testWallet = new ethers.Wallet(privateKey, testProvider);
    const testContract = new ethers.Contract(
      contractAddress,
      contractABI,
      testWallet,
    );

    // Get network chain ID
    const network = await testProvider.getNetwork();
    const chainId = network.chainId.toString();

    // Call read-only function to verify contract is callable
    const documentCounter = await testContract.documentCounter();

    logger.info(
      `Blockchain connection successful (Chain: ${chainId}, Documents: ${documentCounter})`,
    );
  } catch (error) {
    logger.error("Blockchain initialization failed");
    logger.error(`Error: ${error.message}`);
    if (error.code) {
      logger.error(`Code: ${error.code}`);
    }
    process.exit(1);
  }
};

module.exports = {
  createDocument,
  addVersion,
  getDocument,
  verifyBlockchainConnection,
  contract,
  wallet,
  provider,
};
