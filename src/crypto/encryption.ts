/**
 * Encryption and decryption operations
 * 
 * Uses AES-256-GCM for authenticated encryption.
 * All operations are designed to be constant-time where possible.
 */

import { randomBytes } from '@noble/hashes/utils';
import type { Ciphertext, MAC, Nonce } from './types.js';
import { CRYPTO_CONSTANTS } from './constants.js';

/**
 * Encrypt plaintext with AES-256-GCM
 * 
 * @param plaintext - Data to encrypt
 * @param key - 32-byte encryption key
 * @param iv - 12-byte initialization vector (generated if not provided)
 * @param additionalData - Optional authenticated additional data
 * @returns Object containing ciphertext and authentication tag
 */
export async function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv?: Uint8Array,
  additionalData?: Uint8Array
): Promise<{ ciphertext: Ciphertext; tag: MAC; iv: Nonce }> {
  if (key.length !== CRYPTO_CONSTANTS.MESSAGE_KEY_SIZE) {
    throw new Error('Invalid encryption key size');
  }
  
  if (plaintext.length > CRYPTO_CONSTANTS.MAX_MESSAGE_SIZE) {
    throw new Error('Message too large');
  }
  
  const actualIv = iv || randomBytes(CRYPTO_CONSTANTS.AES_IV_SIZE);
  
  if (actualIv.length !== CRYPTO_CONSTANTS.AES_IV_SIZE) {
    throw new Error('Invalid IV size');
  }
  
  // Use Web Crypto API for AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: actualIv,
      tagLength: CRYPTO_CONSTANTS.AES_TAG_SIZE * 8, // in bits
      additionalData,
    },
    cryptoKey,
    plaintext
  );
  
  // GCM tag is appended to ciphertext
  const totalLength = encrypted.byteLength;
  const tagLength = CRYPTO_CONSTANTS.AES_TAG_SIZE;
  const ciphertextLength = totalLength - tagLength;
  
  return {
    ciphertext: new Uint8Array(encrypted.slice(0, ciphertextLength)),
    tag: new Uint8Array(encrypted.slice(ciphertextLength)),
    iv: actualIv,
  };
}

/**
 * Decrypt ciphertext with AES-256-GCM
 * 
 * @param ciphertext - Encrypted data
 * @param tag - Authentication tag
 * @param key - 32-byte decryption key
 * @param iv - 12-byte initialization vector
 * @param additionalData - Optional authenticated additional data
 * @returns Decrypted plaintext
 * @throws Error if decryption or authentication fails
 */
export async function decrypt(
  ciphertext: Ciphertext,
  tag: MAC,
  key: Uint8Array,
  iv: Nonce,
  additionalData?: Uint8Array
): Promise<Uint8Array> {
  if (key.length !== CRYPTO_CONSTANTS.MESSAGE_KEY_SIZE) {
    throw new Error('Invalid decryption key size');
  }
  
  if (iv.length !== CRYPTO_CONSTANTS.AES_IV_SIZE) {
    throw new Error('Invalid IV size');
  }
  
  if (tag.length !== CRYPTO_CONSTANTS.AES_TAG_SIZE) {
    throw new Error('Invalid tag size');
  }
  
  // Combine ciphertext and tag for Web Crypto API
  const encrypted = new Uint8Array(ciphertext.length + tag.length);
  encrypted.set(ciphertext, 0);
  encrypted.set(tag, ciphertext.length);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: CRYPTO_CONSTANTS.AES_TAG_SIZE * 8,
        additionalData,
      },
      cryptoKey,
      encrypted
    );
    
    return new Uint8Array(decrypted);
  } catch (error) {
    // Authentication failure - don't leak information about why
    throw new Error('Decryption failed: authentication error');
  }
}

/**
 * Compute HMAC-SHA-256
 */
export async function computeMAC(
  data: Uint8Array,
  key: Uint8Array
): Promise<MAC> {
  if (key.length !== CRYPTO_CONSTANTS.MAC_KEY_SIZE) {
    throw new Error('Invalid MAC key size');
  }
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}

/**
 * Verify HMAC-SHA-256
 */
export async function verifyMAC(
  data: Uint8Array,
  key: Uint8Array,
  mac: MAC
): Promise<boolean> {
  const computedMac = await computeMAC(data, key);
  
  // Constant-time comparison
  if (computedMac.length !== mac.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < mac.length; i++) {
    const computedByte = computedMac[i];
    const macByte = mac[i];
    if (computedByte !== undefined && macByte !== undefined) {
      result |= computedByte ^ macByte;
    }
  }
  
  return result === 0;
}

