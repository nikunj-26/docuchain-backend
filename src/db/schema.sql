-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index on wallet_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Nonces table for wallet authentication
CREATE TABLE IF NOT EXISTS nonces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(255) NOT NULL UNIQUE,
  nonce VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index on wallet_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_nonces_wallet_address ON nonces(wallet_address);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_nonces_expires_at ON nonces(expires_at);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blockchain_document_id BIGINT,
  title VARCHAR(500) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on user_id for user's documents queries
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

-- Create index on blockchain_document_id for blockchain lookups
CREATE INDEX IF NOT EXISTS idx_documents_blockchain_id ON documents(blockchain_document_id);

-- Document versions table
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  ipfs_cid TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  blockchain_tx_hash TEXT,
  encrypted_key_payload TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_document_version UNIQUE(document_id, version_number)
);

-- Create index on document_id for version queries
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);

-- Create index on blockchain_tx_hash for transaction lookups
CREATE INDEX IF NOT EXISTS idx_document_versions_tx_hash ON document_versions(blockchain_tx_hash);

-- Create index on ipfs_cid for IPFS lookups
CREATE INDEX IF NOT EXISTS idx_document_versions_ipfs_cid ON document_versions(ipfs_cid);
