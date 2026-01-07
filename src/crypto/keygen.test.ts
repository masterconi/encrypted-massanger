/**
 * Tests for key generation and cryptographic operations
 */

import {
  generateIdentityKeyPair,
  generateEphemeralKeyPair,
  sign,
  verify,
  computeSharedSecret,
  derivePublicKey,
} from './keygen';
import { CRYPTO_CONSTANTS } from './constants';

describe('Key Generation', () => {
  test('generates valid identity key pair', () => {
    const keyPair = generateIdentityKeyPair();
    
    expect(keyPair.publicKey.length).toBe(CRYPTO_CONSTANTS.IDENTITY_KEY_SIZE);
    expect(keyPair.privateKey.length).toBe(CRYPTO_CONSTANTS.IDENTITY_PRIVATE_KEY_SIZE);
  });

  test('generates unique identity key pairs', () => {
    const keyPair1 = generateIdentityKeyPair();
    const keyPair2 = generateIdentityKeyPair();
    
    expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
    expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
  });

  test('generates valid ephemeral key pair', () => {
    const keyPair = generateEphemeralKeyPair();
    
    expect(keyPair.publicKey.length).toBe(CRYPTO_CONSTANTS.EPHEMERAL_KEY_SIZE);
    expect(keyPair.privateKey.length).toBe(CRYPTO_CONSTANTS.EPHEMERAL_KEY_SIZE);
  });

  test('generates unique ephemeral key pairs', () => {
    const keyPair1 = generateEphemeralKeyPair();
    const keyPair2 = generateEphemeralKeyPair();
    
    expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
    expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
  });
});

describe('Digital Signatures', () => {
  test('signs and verifies message', () => {
    const keyPair = generateIdentityKeyPair();
    const message = new TextEncoder().encode('test message');
    
    const signature = sign(keyPair.privateKey, message);
    const isValid = verify(keyPair.publicKey, message, signature);
    
    expect(isValid).toBe(true);
  });

  test('rejects invalid signature', () => {
    const keyPair = generateIdentityKeyPair();
    const message = new TextEncoder().encode('test message');
    const wrongMessage = new TextEncoder().encode('wrong message');
    
    const signature = sign(keyPair.privateKey, message);
    const isValid = verify(keyPair.publicKey, wrongMessage, signature);
    
    expect(isValid).toBe(false);
  });

  test('rejects signature from different key', () => {
    const keyPair1 = generateIdentityKeyPair();
    const keyPair2 = generateIdentityKeyPair();
    const message = new TextEncoder().encode('test message');
    
    const signature = sign(keyPair1.privateKey, message);
    const isValid = verify(keyPair2.publicKey, message, signature);
    
    expect(isValid).toBe(false);
  });
});

describe('Key Exchange', () => {
  test('computes shared secret', () => {
    const aliceKey = generateEphemeralKeyPair();
    const bobKey = generateEphemeralKeyPair();
    
    const aliceSecret = computeSharedSecret(aliceKey.privateKey, bobKey.publicKey);
    const bobSecret = computeSharedSecret(bobKey.privateKey, aliceKey.publicKey);
    
    expect(aliceSecret).toEqual(bobSecret);
    expect(aliceSecret.length).toBe(CRYPTO_CONSTANTS.EPHEMERAL_KEY_SIZE);
  });

  test('derives public key from private key', () => {
    const keyPair = generateEphemeralKeyPair();
    const derivedPublic = derivePublicKey(keyPair.privateKey);
    
    expect(derivedPublic).toEqual(keyPair.publicKey);
  });

  test('shared secret is unique for different key pairs', () => {
    const aliceKey1 = generateEphemeralKeyPair();
    const aliceKey2 = generateEphemeralKeyPair();
    const bobKey = generateEphemeralKeyPair();
    
    const secret1 = computeSharedSecret(aliceKey1.privateKey, bobKey.publicKey);
    const secret2 = computeSharedSecret(aliceKey2.privateKey, bobKey.publicKey);
    
    expect(secret1).not.toEqual(secret2);
  });
});

describe('Error Handling', () => {
  test('throws on invalid private key size for signing', () => {
    const invalidKey = new Uint8Array(32);
    const message = new TextEncoder().encode('test');
    
    expect(() => sign(invalidKey, message)).toThrow();
  });

  test('throws on invalid key sizes for shared secret', () => {
    const invalidKey = new Uint8Array(16);
    const validKey = generateEphemeralKeyPair();
    
    expect(() => computeSharedSecret(invalidKey, validKey.publicKey)).toThrow();
    expect(() => computeSharedSecret(validKey.privateKey, invalidKey)).toThrow();
  });
});

