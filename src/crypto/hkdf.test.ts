/**
 * Tests for HKDF key derivation
 */

import {
  hkdf,
  deriveRootKey,
  deriveChainKey,
  deriveMessageKey,
} from './hkdf.js';
import { CRYPTO_CONSTANTS } from './constants.js';

describe('HKDF', () => {
  test('derives key with correct length', () => {
    const ikm = new Uint8Array(32);
    crypto.getRandomValues(ikm);

    const key = hkdf(ikm, null, 'test-info', 32);

    expect(key.length).toBe(32);
  });

  test('derives different keys for different info', () => {
    const ikm = new Uint8Array(32);
    crypto.getRandomValues(ikm);


    const key1 = hkdf(ikm, null, 'info1', 32);
    const key2 = hkdf(ikm, null, 'info2', 32);



    expect(key1).not.toEqual(key2);
  });

  test('derives different keys for different IKM', () => {
    const ikm1 = new Uint8Array(32);
    const ikm2 = new Uint8Array(32);
    crypto.getRandomValues(ikm1);
    crypto.getRandomValues(ikm2);

    const key1 = hkdf(ikm1, null, 'test-info', 32);
    const key2 = hkdf(ikm2, null, 'test-info', 32);

    expect(key1).not.toEqual(key2);
  });

  test('derives key with salt', () => {
    const ikm = new Uint8Array(32);
    const salt = new Uint8Array(32);
    crypto.getRandomValues(ikm);
    crypto.getRandomValues(salt);

    const key1 = hkdf(ikm, salt, 'test-info', 32);
    const key2 = hkdf(ikm, null, 'test-info', 32);

    expect(key1).not.toEqual(key2);
  });

  test('derives longer keys', () => {
    const ikm = new Uint8Array(32);
    crypto.getRandomValues(ikm);

    const key64 = hkdf(ikm, null, 'test-info', 64);
    const key128 = hkdf(ikm, null, 'test-info', 128);

    expect(key64.length).toBe(64);
    expect(key128.length).toBe(128);
  });
});

describe('Root Key Derivation', () => {
  test('derives root key with correct size', () => {
    const sharedSecret = new Uint8Array(32);
    crypto.getRandomValues(sharedSecret);

    const rootKey = deriveRootKey(sharedSecret);

    expect(rootKey.length).toBe(CRYPTO_CONSTANTS.ROOT_KEY_SIZE);
  });
});

describe('Chain Key Derivation', () => {
  test('derives chain key with correct size', () => {
    const rootKey = new Uint8Array(CRYPTO_CONSTANTS.ROOT_KEY_SIZE);
    crypto.getRandomValues(rootKey);

    const chainKey = deriveChainKey(rootKey);

    expect(chainKey.length).toBe(CRYPTO_CONSTANTS.CHAIN_KEY_SIZE);
  });
});

describe('Message Key Derivation', () => {
  test('derives message key and next chain key', () => {
    const chainKey = new Uint8Array(CRYPTO_CONSTANTS.CHAIN_KEY_SIZE);
    crypto.getRandomValues(chainKey);

    const { messageKey, nextChainKey } = deriveMessageKey(chainKey);

    expect(messageKey.length).toBe(CRYPTO_CONSTANTS.MESSAGE_KEY_SIZE);
    expect(nextChainKey.length).toBe(CRYPTO_CONSTANTS.CHAIN_KEY_SIZE);
    expect(messageKey).not.toEqual(nextChainKey);
  });

  test('derives different keys for different chain keys', () => {
    const chainKey1 = new Uint8Array(CRYPTO_CONSTANTS.CHAIN_KEY_SIZE);
    const chainKey2 = new Uint8Array(CRYPTO_CONSTANTS.CHAIN_KEY_SIZE);
    crypto.getRandomValues(chainKey1);
    crypto.getRandomValues(chainKey2);

    const result1 = deriveMessageKey(chainKey1);
    const result2 = deriveMessageKey(chainKey2);

    expect(result1.messageKey).not.toEqual(result2.messageKey);
    expect(result1.nextChainKey).not.toEqual(result2.nextChainKey);
  });
});

