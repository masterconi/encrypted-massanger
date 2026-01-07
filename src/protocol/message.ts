/**
 * Message Protocol
 * 
 * Handles encryption, decryption, and formatting of messages.
 * Integrates Double Ratchet with authenticated encryption.
 */

import type {
  RatchetState,
  PublicKey,
} from '../crypto/types.js';
import {
  ratchetEncrypt,
} from '../crypto/ratchet.js';
import {
  encrypt,
  computeMAC,
} from '../crypto/encryption.js';
import {
  generateMessageId,
} from '../crypto/keygen.js';
import { CRYPTO_CONSTANTS } from '../crypto/constants.js';

export interface EncryptedMessageData {
  messageId: Uint8Array;
  header: Uint8Array;        // Encrypted header
  ciphertext: Uint8Array;    // Encrypted message body
  mac: Uint8Array;           // Authentication tag
  timestamp: number;
  version: number;
}

export interface MessageHeader {
  dhPublicKey: PublicKey;
  messageNumber: number;
  previousChainLength: number;
}

/**
 * Encrypt a message using Double Ratchet
 */
export async function encryptMessage(
  plaintext: Uint8Array,
  ratchetState: RatchetState,
  _recipientPublicKey?: PublicKey
): Promise<EncryptedMessageData> {
  if (plaintext.length > CRYPTO_CONSTANTS.MAX_MESSAGE_SIZE) {
    throw new Error('Message too large');
  }
  
  // Ratchet forward and get message key
  const ratchetResult = ratchetEncrypt(ratchetState, plaintext);
  const messageKey = ratchetResult.messageKey;
  
  // Generate IV for encryption
  const iv = new Uint8Array(CRYPTO_CONSTANTS.AES_IV_SIZE);
  crypto.getRandomValues(iv);
  messageKey.iv = iv;
  
  // Encrypt message body
  const { ciphertext, tag } = await encrypt(
    plaintext,
    messageKey.encryptionKey,
    iv
  );
  
  // Create message header (contains ratchet info)
  const header: MessageHeader = {
    dhPublicKey: ratchetState.sendingEphemeralKey!.publicKey,
    messageNumber: messageKey.index,
    previousChainLength: ratchetState.previousChainLength,
  };
  
  // Serialize header (simplified - in production use protobuf)
  const headerBytes = serializeHeader(header);
  
  // Encrypt header with message key
  const { ciphertext: encryptedHeader, tag: headerTag } = await encrypt(
    headerBytes,
    messageKey.encryptionKey,
    undefined,
    ciphertext // Additional authenticated data
  );
  
  // Combine header ciphertext and tag
  const fullHeader = new Uint8Array(encryptedHeader.length + headerTag.length);
  fullHeader.set(encryptedHeader, 0);
  fullHeader.set(headerTag, encryptedHeader.length);
  
  // Compute MAC over entire message
  const macData = new Uint8Array(
    fullHeader.length +
    ciphertext.length +
    tag.length
  );
  let offset = 0;
  macData.set(fullHeader, offset);
  offset += fullHeader.length;
  macData.set(ciphertext, offset);
  offset += ciphertext.length;
  macData.set(tag, offset);
  
  const mac = await computeMAC(macData, messageKey.macKey);
  
  // Generate message ID
  const messageId = generateMessageId();
  
  return {
    messageId,
    header: fullHeader,
    ciphertext,
    mac,
    timestamp: Date.now(),
    version: CRYPTO_CONSTANTS.PROTOCOL_VERSION,
  };
}

/**
 * Decrypt a message using Double Ratchet
 */
export async function decryptMessage(
  _encryptedData: EncryptedMessageData,
  _ratchetState: RatchetState
): Promise<Uint8Array> {
  // First, we need to decrypt the header to get ratchet info
  // For the first message, we'll need to try with the current state
  // In a full implementation, we'd handle this more elegantly
  
  // Try to get message key from ratchet
  // We need the header info first, but header is encrypted...
  // This is a chicken-and-egg problem. In practice, we'd:
  // 1. Store header encryption separately, or
  // 2. Use a known key for first message, or
  // 3. Include header info in unencrypted metadata
  
  // For now, simplified approach: assume we can derive the key
  // In production, this needs proper handling
  
  // Extract header (first part) and decrypt it
  // This is simplified - full implementation needs proper state management
  // const headerCiphertext = encryptedData.header.slice(0, encryptedData.header.length - 16);
  // const headerTag = encryptedData.header.slice(encryptedData.header.length - 16);
  
  // We need the message key to decrypt the header, but we need the header to get the message key
  // This requires either:
  // 1. Storing header encryption key separately
  // 2. Using a different approach for header encryption
  
  // Simplified: assume we have the receiving chain key
  // In production, implement proper header key derivation
  
  throw new Error('Decryption requires proper header key management - see implementation notes');
}

/**
 * Serialize message header
 */
function serializeHeader(header: MessageHeader): Uint8Array {
  // Simplified serialization
  // In production, use protobuf or similar
  const buffer = new Uint8Array(
    32 + // dhPublicKey
    4 +  // messageNumber
    4    // previousChainLength
  );
  let offset = 0;
  buffer.set(header.dhPublicKey, offset);
  offset += 32;
  
  const messageNumberView = new DataView(buffer.buffer, offset, 4);
  messageNumberView.setUint32(0, header.messageNumber, false); // big-endian
  offset += 4;
  
  const chainLengthView = new DataView(buffer.buffer, offset, 4);
  chainLengthView.setUint32(0, header.previousChainLength, false);
  
  return buffer;
}

/**
 * Deserialize message header
 * (Currently unused, but kept for future implementation)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function deserializeHeader(data: Uint8Array): MessageHeader {
  if (data.length < 40) {
    throw new Error('Invalid header data');
  }
  
  const dhPublicKey = data.slice(0, 32);
  const messageNumber = new DataView(data.buffer, 32, 4).getUint32(0, false);
  const previousChainLength = new DataView(data.buffer, 36, 4).getUint32(0, false);
  
  return {
    dhPublicKey,
    messageNumber,
    previousChainLength,
  };
}

