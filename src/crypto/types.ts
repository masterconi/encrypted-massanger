/**
 * Cryptographic types and interfaces
 * 
 * All cryptographic operations use constant-time implementations where possible.
 * Keys are stored in secure memory and zeroed when no longer needed.
 */

export type PublicKey = Uint8Array;
export type PrivateKey = Uint8Array;
export type SharedSecret = Uint8Array;
export type Nonce = Uint8Array;
export type MAC = Uint8Array;
export type Ciphertext = Uint8Array;

/**
 * Identity key pair (Ed25519)
 * Used for long-term identity and signing
 */
export interface IdentityKeyPair {
  publicKey: PublicKey;  // 32 bytes
  privateKey: PrivateKey; // 64 bytes (32 bytes seed + 32 bytes public key)
}

/**
 * Ephemeral key pair (X25519)
 * Used for key exchange in handshakes
 */
export interface EphemeralKeyPair {
  publicKey: PublicKey;  // 32 bytes
  privateKey: PrivateKey; // 32 bytes
}

/**
 * Chain key for Double Ratchet
 * Used to derive message keys
 */
export interface ChainKey {
  key: Uint8Array;  // 32 bytes
  index: number;    // Current index in chain
}

/**
 * Message key for encryption/decryption
 * Derived from chain key, used once, then discarded
 */
export interface MessageKey {
  encryptionKey: Uint8Array;  // 32 bytes
  macKey: Uint8Array;         // 32 bytes
  iv: Uint8Array;             // 12 bytes (for AES-GCM)
  index: number;              // Message number
}

/**
 * Root key for Double Ratchet
 * Used to derive new chain keys
 */
export interface RootKey {
  key: Uint8Array;  // 32 bytes
}

/**
 * Double Ratchet state
 * Maintains separate sending and receiving chains
 */
export interface RatchetState {
  rootKey: RootKey;
  sendingChainKey?: ChainKey;
  receivingChainKey?: ChainKey;
  sendingEphemeralKey?: EphemeralKeyPair;
  receivingEphemeralPublicKey?: PublicKey;
  skippedMessageKeys: Map<number, MessageKey>; // For out-of-order messages
  previousChainLength: number;
}

