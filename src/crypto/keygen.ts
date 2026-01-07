/**
 * Key generation and management
 * 
 * Uses audited cryptographic libraries (@noble/curves, @noble/hashes)
 * All operations are constant-time where possible.
 */

import { ed25519 } from '@noble/curves/ed25519';
import { x25519 } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';
import type {
  IdentityKeyPair,
  EphemeralKeyPair,
  PrivateKey,
  PublicKey,
} from './types.js';
import { CRYPTO_CONSTANTS, secureZeroMemory } from './constants.js';

/**
 * Generate a new Ed25519 identity key pair
 * 
 * This is a long-term key used for identity and signing.
 * Must be stored securely (OS secure enclave when available).
 */
export function generateIdentityKeyPair(): IdentityKeyPair {
  // Ed25519 private key is 32 bytes (seed)
  const seed = randomBytes(CRYPTO_CONSTANTS.IDENTITY_KEY_SIZE);
  const publicKey = ed25519.getPublicKey(seed);
  
  // Ed25519 private key format: seed || publicKey (64 bytes)
  const privateKey = new Uint8Array(CRYPTO_CONSTANTS.IDENTITY_PRIVATE_KEY_SIZE);
  privateKey.set(seed, 0);
  privateKey.set(publicKey, CRYPTO_CONSTANTS.IDENTITY_KEY_SIZE);
  
  // Zero the seed copy (privateKey still contains it)
  secureZeroMemory(seed);
  
  return {
    publicKey,
    privateKey,
  };
}

/**
 * Generate a new X25519 ephemeral key pair
 * 
 * Used for key exchange in handshakes.
 * Ephemeral keys should be discarded after use.
 */
export function generateEphemeralKeyPair(): EphemeralKeyPair {
  // X25519 private key is 32 bytes
  const privateKey = randomBytes(CRYPTO_CONSTANTS.EPHEMERAL_KEY_SIZE);
  const publicKey = x25519.getPublicKey(privateKey);
  
  return {
    publicKey,
    privateKey,
  };
}

/**
 * Derive X25519 public key from private key
 */
export function derivePublicKey(privateKey: PrivateKey): PublicKey {
  if (privateKey.length !== CRYPTO_CONSTANTS.EPHEMERAL_KEY_SIZE) {
    throw new Error('Invalid private key size');
  }
  return x25519.getPublicKey(privateKey);
}

/**
 * Compute X25519 shared secret
 * 
 * Returns the shared secret from ECDH key exchange.
 * Must be used with HKDF before use as a key.
 */
export function computeSharedSecret(
  privateKey: PrivateKey,
  publicKey: PublicKey
): Uint8Array {
  if (privateKey.length !== CRYPTO_CONSTANTS.EPHEMERAL_KEY_SIZE) {
    throw new Error('Invalid private key size');
  }
  if (publicKey.length !== CRYPTO_CONSTANTS.EPHEMERAL_KEY_SIZE) {
    throw new Error('Invalid public key size');
  }
  
  try {
    return x25519.getSharedSecret(privateKey, publicKey);
  } catch (error) {
    throw new Error(`Shared secret computation failed: ${error}`);
  }
}

/**
 * Sign data with Ed25519
 */
export function sign(
  privateKey: PrivateKey,
  message: Uint8Array
): Uint8Array {
  if (privateKey.length !== CRYPTO_CONSTANTS.IDENTITY_PRIVATE_KEY_SIZE) {
    throw new Error('Invalid private key size for signing');
  }
  
  // Extract seed (first 32 bytes)
  const seed = privateKey.slice(0, CRYPTO_CONSTANTS.IDENTITY_KEY_SIZE);
  return ed25519.sign(message, seed);
}

/**
 * Verify Ed25519 signature
 */
export function verify(
  publicKey: PublicKey,
  message: Uint8Array,
  signature: Uint8Array
): boolean {
  if (publicKey.length !== CRYPTO_CONSTANTS.IDENTITY_KEY_SIZE) {
    throw new Error('Invalid public key size');
  }
  
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

/**
 * Generate random nonce
 */
export function generateNonce(): Uint8Array {
  return randomBytes(CRYPTO_CONSTANTS.NONCE_SIZE);
}

/**
 * Generate random message ID
 */
export function generateMessageId(): Uint8Array {
  return randomBytes(CRYPTO_CONSTANTS.MESSAGE_ID_SIZE);
}

