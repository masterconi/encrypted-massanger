/**
 * HKDF (HMAC-based Key Derivation Function)
 * 
 * Implements HKDF-SHA-256 as specified in RFC 5869.
 * Used for secure key derivation with domain separation.
 */

import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { CRYPTO_CONSTANTS } from './constants.js';

/**
 * Extract phase of HKDF
 * 
 * @param salt - Optional salt (use zero if not provided)
 * @param inputKeyMaterial - Input key material (IKM)
 * @returns Pseudo-random key (PRK)
 */
function hkdfExtract(salt: Uint8Array | null, inputKeyMaterial: Uint8Array): Uint8Array {
  const actualSalt = salt || new Uint8Array(CRYPTO_CONSTANTS.CHAIN_KEY_SIZE);
  return hmac(sha256, actualSalt, inputKeyMaterial);
}

/**
 * Expand phase of HKDF
 * 
 * @param prk - Pseudo-random key from extract phase
 * @param info - Context and application specific information
 * @param length - Desired output length in bytes
 * @returns Output keying material (OKM)
 */
function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  if (length > 255 * 32) {
    throw new Error('HKDF output length too large');
  }
  
  const n = Math.ceil(length / 32);
  const output = new Uint8Array(length);
  const temp = new Uint8Array(32 + info.length + 1);
  
  let offset = 0;
  for (let i = 1; i <= n; i++) {
    // T(i) = HMAC-Hash(PRK, T(i-1) | INFO | i)
    if (i > 1) {
      temp.set(output.slice(offset - 32, offset), 0);
    }
    temp.set(info, i > 1 ? 32 : 0);
    temp[temp.length - 1] = i;
    
    const hmacResult = hmac(sha256, prk, temp.slice(i > 1 ? 0 : 32));
    const copyLength = Math.min(32, length - offset);
    output.set(hmacResult.slice(0, copyLength), offset);
    offset += copyLength;
  }
  
  return output;
}

/**
 * HKDF: Extract-then-Expand key derivation
 * 
 * @param inputKeyMaterial - Input key material (e.g., shared secret)
 * @param salt - Optional salt (defaults to zeros)
 * @param info - Context information for domain separation
 * @param length - Desired output length
 * @returns Derived key material
 */
export function hkdf(
  inputKeyMaterial: Uint8Array,
  salt: Uint8Array | null,
  info: Uint8Array | string,
  length: number
): Uint8Array {
  if (length === 0) {
    throw new Error('HKDF output length must be > 0');
  }
  
  const infoBytes = typeof info === 'string' 
    ? new TextEncoder().encode(info)
    : info;
  
  const prk = hkdfExtract(salt, inputKeyMaterial);
  return hkdfExpand(prk, infoBytes, length);
}

/**
 * Derive root key from shared secret
 */
export function deriveRootKey(sharedSecret: Uint8Array): Uint8Array {
  return hkdf(
    sharedSecret,
    null,
    CRYPTO_CONSTANTS.HKDF_ROOT_KEY_INFO,
    CRYPTO_CONSTANTS.ROOT_KEY_SIZE
  );
}

/**
 * Derive chain key from root key
 */
export function deriveChainKey(rootKey: Uint8Array, info?: string): Uint8Array {
  const infoString = info || CRYPTO_CONSTANTS.HKDF_CHAIN_KEY_INFO;
  return hkdf(
    rootKey,
    null,
    infoString,
    CRYPTO_CONSTANTS.CHAIN_KEY_SIZE
  );
}

/**
 * Derive message key from chain key
 * 
 * Returns both the message key (encryption key) and the next chain key.
 * Note: MAC key should be derived separately from the message key.
 */
export function deriveMessageKey(chainKey: Uint8Array): {
  messageKey: Uint8Array;  // 32 bytes - encryption key
  nextChainKey: Uint8Array; // 32 bytes - next chain key
} {
  // Derive 64 bytes: 32 for message key (encryption key), 32 for next chain key
  const output = hkdf(
    chainKey,
    null,
    CRYPTO_CONSTANTS.HKDF_MESSAGE_KEY_INFO,
    64
  );
  
  return {
    messageKey: output.slice(0, 32),      // Encryption key
    nextChainKey: output.slice(32, 64),   // Next chain key
  };
}

