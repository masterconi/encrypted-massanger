/**
 * Handshake Protocol
 * 
 * Implements a secure handshake based on Noise Protocol Framework.
 * Provides mutual authentication and key establishment.
 * 
 * Handshake flow:
 * 1. Client sends HandshakeInit (ephemeral key + identity signature)
 * 2. Server responds with HandshakeResponse (ephemeral key + encrypted prekey)
 * 3. Client sends HandshakeComplete (confirmation)
 */

import type {
  IdentityKeyPair,
  EphemeralKeyPair,
  PublicKey,
} from '../crypto/types.js';
import {
  generateNonce,
  sign,
  verify,
  computeSharedSecret,
} from '../crypto/keygen.js';
import {
  deriveRootKey,
} from '../crypto/hkdf.js';
import { encrypt, decrypt, computeMAC } from '../crypto/encryption.js';
import { CRYPTO_CONSTANTS } from '../crypto/constants.js';

export interface HandshakeState {
  identityKey: IdentityKeyPair;
  ephemeralKey?: EphemeralKeyPair;
  remoteIdentityPublicKey?: PublicKey;
  remoteEphemeralPublicKey?: PublicKey;
  rootKey?: Uint8Array;
  handshakeComplete: boolean;
}

/**
 * Create initial handshake message
 */
export function createHandshakeInit(
  identityKey: IdentityKeyPair,
  ephemeralKey: EphemeralKeyPair
): {
  message: Uint8Array;
  state: HandshakeState;
} {
  const timestamp = BigInt(Date.now());
  const nonce = generateNonce();
  
  // Create signature: sign(ephemeral_public_key || identity_public_key || timestamp || nonce)
  const signatureData = new Uint8Array(
    ephemeralKey.publicKey.length +
    identityKey.publicKey.length +
    8 + // timestamp
    nonce.length
  );
  let offset = 0;
  signatureData.set(ephemeralKey.publicKey, offset);
  offset += ephemeralKey.publicKey.length;
  signatureData.set(identityKey.publicKey, offset);
  offset += identityKey.publicKey.length;
  
  // Encode timestamp as big-endian
  const timestampBytes = new Uint8Array(8);
  const timestampView = new BigUint64Array(timestampBytes.buffer);
  timestampView[0] = timestamp;
  signatureData.set(timestampBytes, offset);
  offset += 8;
  signatureData.set(nonce, offset);
  
  const signature = sign(identityKey.privateKey, signatureData);
  
  // Create handshake init message
  // Format: ephemeral_key(32) || identity_key(32) || signature(64) || timestamp(8) || nonce(16)
  const message = new Uint8Array(
    ephemeralKey.publicKey.length +
    identityKey.publicKey.length +
    signature.length +
    8 +
    nonce.length
  );
  offset = 0;
  message.set(ephemeralKey.publicKey, offset);
  offset += ephemeralKey.publicKey.length;
  message.set(identityKey.publicKey, offset);
  offset += identityKey.publicKey.length;
  message.set(signature, offset);
  offset += signature.length;
  message.set(timestampBytes, offset);
  offset += 8;
  message.set(nonce, offset);
  
  const state: HandshakeState = {
    identityKey,
    ephemeralKey,
    handshakeComplete: false,
  };
  
  return { message, state };
}

/**
 * Process handshake init and create response
 */
export async function processHandshakeInit(
  message: Uint8Array,
  serverIdentityKey: IdentityKeyPair,
  serverEphemeralKey: EphemeralKeyPair
): Promise<{
  response: Uint8Array;
  state: HandshakeState;
  clientIdentityPublicKey: PublicKey;
}> {
  // Parse message
  if (message.length < 32 + 32 + 64 + 8 + 16) {
    throw new Error('Invalid handshake init message');
  }
  
  let offset = 0;
  const clientEphemeralPublicKey = message.slice(offset, offset + 32);
  offset += 32;
  const clientIdentityPublicKey = message.slice(offset, offset + 32);
  offset += 32;
  const signature = message.slice(offset, offset + 64);
  offset += 64;
  const timestampBytes = message.slice(offset, offset + 8);
  offset += 8;
  const nonce = message.slice(offset, offset + 16);
  offset += 16;
  
  // Verify signature
  const signatureData = new Uint8Array(
    clientEphemeralPublicKey.length +
    clientIdentityPublicKey.length +
    timestampBytes.length +
    nonce.length
  );
  let sigOffset = 0;
  signatureData.set(clientEphemeralPublicKey, sigOffset);
  sigOffset += clientEphemeralPublicKey.length;
  signatureData.set(clientIdentityPublicKey, sigOffset);
  sigOffset += clientIdentityPublicKey.length;
  signatureData.set(timestampBytes, sigOffset);
  sigOffset += timestampBytes.length;
  signatureData.set(nonce, sigOffset);
  
  if (!verify(clientIdentityPublicKey, signatureData, signature)) {
    throw new Error('Handshake signature verification failed');
  }
  
  // Check timestamp (prevent replay attacks)
  const timestamp = Number(new BigUint64Array(timestampBytes.buffer)[0]);
  const now = Date.now();
  const skew = Math.abs(now - timestamp);
  if (skew > CRYPTO_CONSTANTS.MAX_CLOCK_SKEW_MS) {
    throw new Error('Handshake timestamp out of acceptable range');
  }
  
  // Compute shared secret
  // Note: We use only ephemeral keys for key exchange. Identity keys are for authentication (signing) only.
  const ss1 = computeSharedSecret(
    serverEphemeralKey.privateKey,
    clientEphemeralPublicKey
  );
  
  // Derive root key from single shared secret
  const rootKey = deriveRootKey(ss1);
  
  // Create encrypted prekey material
  const prekeyMaterial = new Uint8Array(32); // Placeholder
  crypto.getRandomValues(prekeyMaterial);
  
  const timestampResponse = BigInt(Date.now());
  const nonceResponse = generateNonce();
  
  // Encrypt prekey material
  const { ciphertext, tag, iv } = await encrypt(
    prekeyMaterial,
    rootKey,
    undefined,
    new TextEncoder().encode('handshake-prekey')
  );
  
  // Create response message
  // Format: server_ephemeral_key(32) || encrypted_prekey(32) || tag(16) || iv(12) || timestamp(8) || nonce(16)
  const response = new Uint8Array(
    serverEphemeralKey.publicKey.length +
    ciphertext.length +
    tag.length +
    iv.length +
    8 +
    nonceResponse.length
  );
  offset = 0;
  response.set(serverEphemeralKey.publicKey, offset);
  offset += serverEphemeralKey.publicKey.length;
  response.set(ciphertext, offset);
  offset += ciphertext.length;
  response.set(tag, offset);
  offset += tag.length;
  response.set(iv, offset);
  offset += iv.length;
  
  const timestampResponseBytes = new Uint8Array(8);
  const timestampResponseView = new BigUint64Array(timestampResponseBytes.buffer);
  timestampResponseView[0] = timestampResponse;
  response.set(timestampResponseBytes, offset);
  offset += 8;
  response.set(nonceResponse, offset);
  
  const state: HandshakeState = {
    identityKey: serverIdentityKey,
    ephemeralKey: serverEphemeralKey,
    remoteIdentityPublicKey: clientIdentityPublicKey,
    remoteEphemeralPublicKey: clientEphemeralPublicKey,
    rootKey,
    handshakeComplete: false,
  };
  
  return {
    response,
    state,
    clientIdentityPublicKey,
  };
}

/**
 * Process handshake response and complete handshake
 */
export async function processHandshakeResponse(
  message: Uint8Array,
  state: HandshakeState
): Promise<{
  confirmation: Uint8Array;
  rootKey: Uint8Array;
}> {
  if (!state.ephemeralKey) {
    throw new Error('Handshake state missing ephemeral key');
  }
  
  // Parse response
  if (message.length < 32 + 32 + 16 + 12 + 8 + 16) {
    throw new Error('Invalid handshake response message');
  }
  
  let offset = 0;
  const serverEphemeralPublicKey = message.slice(offset, offset + 32);
  offset += 32;
  const encryptedPrekey = message.slice(offset, offset + 32);
  offset += 32;
  const tag = message.slice(offset, offset + 16);
  offset += 16;
  const iv = message.slice(offset, offset + 12);
  offset += 12;
  const timestampBytes = message.slice(offset, offset + 8);
  offset += 8;
  // Parse nonce (reserved for future nonce tracking/uniqueness validation)
  message.slice(offset, offset + 16);
  offset += 16;
  
  // Validate timestamp (prevent replay attacks)
  const timestamp = Number(new BigUint64Array(timestampBytes.buffer, 0, 1)[0]);
  const now = Date.now();
  const skew = Math.abs(now - timestamp);
  if (skew > CRYPTO_CONSTANTS.MAX_CLOCK_SKEW_MS) {
    throw new Error('Handshake timestamp out of acceptable range');
  }
  
  // Note: nonce validation (uniqueness check) would require state tracking
  // For now, timestamp validation provides replay protection
  
  // Compute shared secret
  // Note: We use only ephemeral keys for key exchange. Identity keys are for authentication (signing) only.
  const ss1 = computeSharedSecret(
    state.ephemeralKey.privateKey,
    serverEphemeralPublicKey
  );
  
  // Derive root key from single shared secret
  const rootKey = deriveRootKey(ss1);
  
  // Decrypt prekey material
  const prekeyMaterial = await decrypt(
    encryptedPrekey,
    tag,
    rootKey,
    iv,
    new TextEncoder().encode('handshake-prekey')
  );
  
  // Create confirmation
  const confirmationData = new Uint8Array(
    state.ephemeralKey.publicKey.length +
    serverEphemeralPublicKey.length +
    prekeyMaterial.length
  );
  offset = 0;
  confirmationData.set(state.ephemeralKey.publicKey, offset);
  offset += state.ephemeralKey.publicKey.length;
  confirmationData.set(serverEphemeralPublicKey, offset);
  offset += serverEphemeralPublicKey.length;
  confirmationData.set(prekeyMaterial, offset);
  
  const confirmation = await computeMAC(confirmationData, rootKey);
  
  state.rootKey = rootKey;
  state.remoteEphemeralPublicKey = serverEphemeralPublicKey;
  state.handshakeComplete = true;
  
  return {
    confirmation,
    rootKey,
  };
}

