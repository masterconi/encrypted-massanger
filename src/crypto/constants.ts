/**
 * Cryptographic constants
 * 
 * All sizes are in bytes unless otherwise specified.
 */

export const CRYPTO_CONSTANTS = {
  // Key sizes
  IDENTITY_KEY_SIZE: 32,        // Ed25519 public key
  IDENTITY_PRIVATE_KEY_SIZE: 64, // Ed25519 private key (seed + public)
  EPHEMERAL_KEY_SIZE: 32,       // X25519 key size
  CHAIN_KEY_SIZE: 32,           // HKDF output size
  ROOT_KEY_SIZE: 32,            // HKDF output size
  MESSAGE_KEY_SIZE: 32,         // AES-256 key size
  MAC_KEY_SIZE: 32,             // HMAC key size
  
  // Nonce and IV sizes
  NONCE_SIZE: 16,               // Random nonce for handshakes
  AES_IV_SIZE: 12,              // AES-GCM IV size
  AES_TAG_SIZE: 16,             // AES-GCM authentication tag
  
  // Message limits
  MAX_MESSAGE_SIZE: 1024 * 1024, // 1 MB max message size
  MAX_CHAIN_LENGTH: 2 ** 32 - 1,  // Max messages per chain
  MAX_SKIPPED_MESSAGES: 1000,     // Max skipped messages to store
  
  // Protocol
  PROTOCOL_VERSION: 1,
  MESSAGE_ID_SIZE: 16,
  
  // Timing
  MESSAGE_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  KEY_ROTATION_INTERVAL: 100,                  // Rotate after 100 messages
  MAX_CLOCK_SKEW_MS: 5 * 60 * 1000,           // 5 minutes
  
  // HKDF info strings (domain separation)
  HKDF_ROOT_KEY_INFO: 'SecureMessenger-RootKey',
  HKDF_CHAIN_KEY_INFO: 'SecureMessenger-ChainKey',
  HKDF_MESSAGE_KEY_INFO: 'SecureMessenger-MessageKey',
  HKDF_HANDSHAKE_INFO: 'SecureMessenger-Handshake',
} as const;

/**
 * Secure memory utilities
 * Attempts to zero memory (best effort, not guaranteed on all platforms)
 */
export function secureZeroMemory(data: Uint8Array): void {
  // Note: JavaScript/TypeScript cannot guarantee memory zeroing
  // This is best-effort. For production, consider using WebAssembly
  // with explicit memory management or native modules.
  if (data && data.length > 0) {
    crypto.getRandomValues(data);
    data.fill(0);
  }
}

