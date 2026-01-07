/**
 * Double Ratchet Protocol Implementation
 * 
 * Provides forward secrecy and post-compromise security.
 * Based on the Signal Protocol's Double Ratchet.
 * 
 * Key properties:
 * - Forward secrecy: Past messages remain secure if keys are compromised
 * - Post-compromise security: Future messages become secure after key update
 * - Out-of-order message handling: Can decrypt messages received out of order
 */

import type {
  RatchetState,
  RootKey,
  MessageKey,
  EphemeralKeyPair,
  PublicKey,
} from './types.js';
import { CRYPTO_CONSTANTS, secureZeroMemory } from './constants.js';
import {
  computeSharedSecret,
  generateEphemeralKeyPair,
} from './keygen.js';
import {
  deriveRootKey,
  deriveChainKey,
  deriveMessageKey,
  hkdf,
} from './hkdf.js';

/**
 * Initialize a new ratchet state
 */
export function createRatchetState(): RatchetState {
  return {
    rootKey: { key: new Uint8Array(CRYPTO_CONSTANTS.ROOT_KEY_SIZE) },
    skippedMessageKeys: new Map(),
    previousChainLength: 0,
  };
}

/**
 * Initialize ratchet from handshake
 * 
 * This is called after a successful handshake to set up the initial
 * ratchet state with the derived root key.
 */
export function initializeRatchet(
  state: RatchetState,
  rootKey: RootKey,
  sendingEphemeralKey?: EphemeralKeyPair,
  receivingEphemeralPublicKey?: PublicKey
): void {
  state.rootKey = rootKey;
  if (sendingEphemeralKey !== undefined) {
    state.sendingEphemeralKey = sendingEphemeralKey;
  }
  if (receivingEphemeralPublicKey !== undefined) {
    state.receivingEphemeralPublicKey = receivingEphemeralPublicKey;
  }
  state.previousChainLength = 0;
}

/**
 * Ratchet forward (sending side)
 * 
 * Called when sending a message. Derives a new message key and
 * updates the ratchet state.
 */
export function ratchetEncrypt(
  state: RatchetState,
  plaintext: Uint8Array
): {
  messageKey: MessageKey;
  header: Uint8Array; // Encrypted header containing ratchet info
  ciphertext: Uint8Array;
} {
  // Ensure we have a sending chain
  if (!state.sendingChainKey) {
    if (!state.sendingEphemeralKey) {
      // Generate new ephemeral key pair
      state.sendingEphemeralKey = generateEphemeralKeyPair();
    }
    
    // Derive new chain key from root key
    const chainKeyBytes = deriveChainKey(
      state.rootKey.key,
      `sending-${Date.now()}`
    );
    state.sendingChainKey = {
      key: chainKeyBytes,
      index: 0,
    };
  }
  
  // Derive message key from chain key
  const { messageKey: messageKeyBytes, nextChainKey } = deriveMessageKey(
    state.sendingChainKey.key
  );
  
  // Create message key structure
  // messageKeyBytes is 32 bytes (encryption key), we need to derive MAC key separately
  // For now, use HKDF to derive both from messageKeyBytes
  const macKey = hkdf(messageKeyBytes, null, 'mac-key', 32);
  const messageKey: MessageKey = {
    encryptionKey: messageKeyBytes,
    macKey: macKey,
    iv: new Uint8Array(CRYPTO_CONSTANTS.AES_IV_SIZE), // Will be generated during encryption
    index: state.sendingChainKey.index,
  };
  
  // Update chain key
  state.sendingChainKey = {
    key: nextChainKey,
    index: state.sendingChainKey.index + 1,
  };
  
  // Check chain length limit
  if (state.sendingChainKey.index >= CRYPTO_CONSTANTS.MAX_CHAIN_LENGTH) {
    throw new Error('Chain length exceeded, must perform new handshake');
  }
  
  // For now, return simplified structure
  // In full implementation, header would be encrypted separately
  const header = new Uint8Array(0); // Placeholder
  
  return {
    messageKey,
    header,
    ciphertext: plaintext, // Placeholder - actual encryption happens in protocol layer
  };
}

/**
 * Ratchet forward (receiving side)
 * 
 * Called when receiving a message. Updates the ratchet state and
 * derives the message key for decryption.
 */
export function ratchetDecrypt(
  state: RatchetState,
  dhPublicKey: PublicKey,
  messageNumber: number,
  _previousChainLength: number
): MessageKey {
  // Check if this is a new DH key (new chain)
  const isNewChain = !state.receivingEphemeralPublicKey ||
    !constantTimeEqual(state.receivingEphemeralPublicKey, dhPublicKey);
  
  if (isNewChain) {
    // Save previous chain length
    state.previousChainLength = state.receivingChainKey?.index || 0;
    
    // Compute new root key and chain key
    if (!state.sendingEphemeralKey) {
      throw new Error('Cannot ratchet: no sending ephemeral key');
    }
    
    const sharedSecret = computeSharedSecret(
      state.sendingEphemeralKey.privateKey,
      dhPublicKey
    );
    
    // Derive new root key
    const rootKeyInput = new Uint8Array(
      state.rootKey.key.length + sharedSecret.length
    );
    rootKeyInput.set(state.rootKey.key, 0);
    rootKeyInput.set(sharedSecret, state.rootKey.key.length);
    
    state.rootKey = {
      key: deriveRootKey(rootKeyInput),
    };
    
    // Derive new receiving chain key
    const chainKeyBytes = deriveChainKey(
      state.rootKey.key,
      `receiving-${Date.now()}`
    );
    state.receivingChainKey = {
      key: chainKeyBytes,
      index: 0,
    };
    
    state.receivingEphemeralPublicKey = dhPublicKey;
    
    // Zero shared secret
    secureZeroMemory(sharedSecret);
  }
  
  // Check if message is from a skipped chain
  if (messageNumber < state.previousChainLength) {
    // Try to find in skipped message keys
    const skippedKey = state.skippedMessageKeys.get(messageNumber);
    if (skippedKey) {
      state.skippedMessageKeys.delete(messageNumber);
      return skippedKey;
    }
    throw new Error('Message from old chain, key not available');
  }
  
  // Check if message is out of order (future message)
  if (!state.receivingChainKey) {
    throw new Error('No receiving chain key available');
  }
  
  if (messageNumber > state.receivingChainKey.index) {
    // Skip forward to this message number
    const skipCount = messageNumber - state.receivingChainKey.index;
    if (skipCount > CRYPTO_CONSTANTS.MAX_SKIPPED_MESSAGES) {
      throw new Error('Too many skipped messages');
    }
    
    // Derive keys for skipped messages and store them
    let currentKey = state.receivingChainKey.key;
    let currentIndex = state.receivingChainKey.index;
    
    while (currentIndex < messageNumber) {
      const { messageKey: messageKeyBytes, nextChainKey } = deriveMessageKey(
        currentKey
      );
      
      if (currentIndex < messageNumber - 1) {
        // Store skipped message key
        const skippedMacKey = hkdf(messageKeyBytes, null, 'mac-key', 32);
        const skippedKey: MessageKey = {
          encryptionKey: messageKeyBytes,
          macKey: skippedMacKey,
          iv: new Uint8Array(CRYPTO_CONSTANTS.AES_IV_SIZE),
          index: currentIndex,
        };
        state.skippedMessageKeys.set(currentIndex, skippedKey);
      }
      
      currentKey = nextChainKey;
      currentIndex++;
    }
    
    state.receivingChainKey = {
      key: currentKey,
      index: currentIndex,
    };
  }
  
  // Derive message key for current message
  const { messageKey: messageKeyBytes, nextChainKey } = deriveMessageKey(
    state.receivingChainKey.key
  );
  
  // Derive MAC key from encryption key
  const macKey = hkdf(messageKeyBytes, null, 'mac-key', 32);
  const messageKey: MessageKey = {
    encryptionKey: messageKeyBytes,
    macKey: macKey,
    iv: new Uint8Array(CRYPTO_CONSTANTS.AES_IV_SIZE),
    index: state.receivingChainKey.index,
  };
  
  // Update chain key
  state.receivingChainKey = {
    key: nextChainKey,
    index: state.receivingChainKey.index + 1,
  };
  
  return messageKey;
}

/**
 * Constant-time comparison
 * Prevents timing attacks
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    const aByte = a[i];
    const bByte = b[i];
    if (aByte !== undefined && bByte !== undefined) {
      result |= aByte ^ bByte;
    }
  }
  
  return result === 0;
}

/**
 * Clean up ratchet state (zero sensitive data)
 */
export function cleanupRatchet(state: RatchetState): void {
  if (state.rootKey?.key) {
    secureZeroMemory(state.rootKey.key);
  }
  if (state.sendingChainKey?.key) {
    secureZeroMemory(state.sendingChainKey.key);
  }
  if (state.receivingChainKey?.key) {
    secureZeroMemory(state.receivingChainKey.key);
  }
  if (state.sendingEphemeralKey?.privateKey) {
    secureZeroMemory(state.sendingEphemeralKey.privateKey);
  }
  
  // Clean up skipped message keys
  for (const key of state.skippedMessageKeys.values()) {
    secureZeroMemory(key.encryptionKey);
    secureZeroMemory(key.macKey);
  }
  state.skippedMessageKeys.clear();
}

