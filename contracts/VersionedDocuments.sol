// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Ownable} from "./Ownable.sol";

contract VersionedDocuments is Ownable {
    // Custom error for gas optimization
    error InvalidDocumentId();

    struct Version {
        string cid;
        bytes32 fileHash;
        uint256 timestamp;
    }

    struct Document {
        address owner;
        string title;
        Version[] versions;
    }

    uint256 public documentCounter;

    mapping(uint256 => Document) private documents;
    mapping(address => uint256[]) private userDocuments;

    event DocumentCreated(uint256 indexed documentId, address indexed owner, string title);

    event VersionAdded(
        uint256 indexed documentId,
        address indexed owner, // Added for easier filtering off-chain
        string cid,
        bytes32 fileHash
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ---------------------------
    // CREATE NEW DOCUMENT (v1)
    // ---------------------------
    function createDocument(address _owner, string calldata _title, string calldata _cid, bytes32 _fileHash)
        external
        onlyOwner
    {
        documentCounter++;

        Document storage doc = documents[documentCounter];
        doc.owner = _owner;
        doc.title = _title;

        doc.versions.push(Version({cid: _cid, fileHash: _fileHash, timestamp: block.timestamp}));

        userDocuments[_owner].push(documentCounter);

        emit DocumentCreated(documentCounter, _owner, _title);
    }

    // ---------------------------
    // ADD NEW VERSION
    // ---------------------------
    function addVersion(uint256 _documentId, string calldata _cid, bytes32 _fileHash) external onlyOwner {
        if (_documentId == 0 || _documentId > documentCounter) {
            revert InvalidDocumentId();
        }

        documents[_documentId].versions.push(Version({cid: _cid, fileHash: _fileHash, timestamp: block.timestamp}));

        // Emitting the owner here makes it easier for your backend to index
        emit VersionAdded(_documentId, documents[_documentId].owner, _cid, _fileHash);
    }

    // ---------------------------
    // GET DOCUMENT META
    // ---------------------------
    function getDocument(uint256 _documentId)
        external
        view
        returns (address owner, string memory title, uint256 versionCount)
    {
        if (_documentId == 0 || _documentId > documentCounter) {
            revert InvalidDocumentId();
        }

        Document storage doc = documents[_documentId];

        return (doc.owner, doc.title, doc.versions.length);
    }

    // ---------------------------
    // GET ALL VERSIONS
    // ---------------------------
    function getVersions(uint256 _documentId) external view returns (Version[] memory) {
        if (_documentId == 0 || _documentId > documentCounter) {
            revert InvalidDocumentId();
        }

        return documents[_documentId].versions;
    }

    // ---------------------------
    // GET USER DOCUMENT IDS
    // ---------------------------
    function getUserDocuments(address _user) external view returns (uint256[] memory) {
        return userDocuments[_user];
    }
}
