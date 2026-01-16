/**
 * Tests for encryption and decryption operations
 */

import {
  encrypt,
  decrypt,
  computeMAC,
  verifyMAC,
} from './encryption.js';
import { CRYPTO_CONSTANTS } from './constants.js';

describe('Encryption', () => {
  test('encrypts and decrypts message', async () => {
    const plaintext = new TextEncoder().encode('test message');
    const key = new Uint8Array(CRYPTO_CONSTANTS.MESSAGE_KEY_SIZE);
    crypto.getRandomValues(key);

    const { ciphertext, tag, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, tag, key, iv);

    expect(decrypted).toEqual(plaintext);
  });

  test('encrypts different messages differently', async () => {
    const plaintext = new TextEncoder().encode('test message');
    const key = new Uint8Array(CRYPTO_CONSTANTS.MESSAGE_KEY_SIZE);
    crypto.getRandomValues(key);

    const result1 = await encrypt(plaintext, key);
    const result2 = await encrypt(plaintext, key);

    // Ciphertext should be different due to random IV
    expect(result1.ciphertext).not.toEqual(result2.ciphertext);
    expect(result1.iv).not.toEqual(result2.iv);
  });

  test('fails to decrypt with wrong key', async () => {
    const plaintext = new TextEncoder().encode('test message');
    const key1 = new Uint8Array(CRYPTO_CONSTANTS.MESSAGE_KEY_SIZE);
    const key2 = new Uint8Array(CRYPTO_CONSTANTS.MESSAGE_KEY_SIZE);
    crypto.getRandomValues(key1);
    crypto.getRandomValues(key2);

    const { ciphertext, tag, iv } = await encrypt(plaintext, key1);

    await expect(decrypt(ciphertext, tag, key2, iv)).rejects.toThrow();
  });

  test('fails to decrypt with wrong tag', async () => {
    const plaintext = new TextEncoder().encode('test message');
    const key = new Uint8Array(CRYPTO_CONSTANTS.MESSAGE_KEY_SIZE);
    crypto.getRandomValues(key);

    const { ciphertext, tag, iv } = await encrypt(plaintext, key);
    const wrongTag = new Uint8Array(tag);
    wrongTag[0] ^= 1; // Flip one bit

    await expect(decrypt(ciphertext, wrongTag, key, iv)).rejects.toThrow();
  });

  test('fails to decrypt with wrong IV', async () => {
    const plaintext = new TextEncoder().encode('test message');
    const key = new Uint8Array(CRYPTO_CONSTANTS.MESSAGE_KEY_SIZE);
    crypto.getRandomValues(key);

    const { ciphertext, tag, iv } = await encrypt(plaintext, key);
    const wrongIv = new Uint8Array(iv);
    wrongIv[0] ^= 1; // Flip one bit

    await expect(decrypt(ciphertext, tag, key, wrongIv)).rejects.toThrow();
  });

  test('rejects message that is too large', async () => {
    const plaintext = new Uint8Array(CRYPTO_CONSTANTS.MAX_MESSAGE_SIZE + 1);
    const key = new Uint8Array(CRYPTO_CONSTANTS.MESSAGE_KEY_SIZE);
    crypto.getRandomValues(key);

    await expect(encrypt(plaintext, key)).rejects.toThrow();
  });
});

describe('MAC', () => {
  test('computes and verifies MAC', async () => {
    const data = new TextEncoder().encode('test data');
    const key = new Uint8Array(CRYPTO_CONSTANTS.MAC_KEY_SIZE);
    crypto.getRandomValues(key);

    const mac = await computeMAC(data, key);
    const isValid = await verifyMAC(data, key, mac);

    expect(isValid).toBe(true);
  });

  test('rejects MAC for different data', async () => {
    const data1 = new TextEncoder().encode('test data');
    const data2 = new TextEncoder().encode('different data');
    const key = new Uint8Array(CRYPTO_CONSTANTS.MAC_KEY_SIZE);
    crypto.getRandomValues(key);

    const mac = await computeMAC(data1, key);
    const isValid = await verifyMAC(data2, key, mac);

    expect(isValid).toBe(false);
  });

  test('rejects MAC with different key', async () => {
    const data = new TextEncoder().encode('test data');
    const key1 = new Uint8Array(CRYPTO_CONSTANTS.MAC_KEY_SIZE);
    const key2 = new Uint8Array(CRYPTO_CONSTANTS.MAC_KEY_SIZE);
    crypto.getRandomValues(key1);
    crypto.getRandomValues(key2);

    const mac = await computeMAC(data, key1);
    const isValid = await verifyMAC(data, key2, mac);

    expect(isValid).toBe(false);
  });
});

