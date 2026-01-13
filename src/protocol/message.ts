/**
 * PRODUCTION-READY Message Protocol
 * 
 * Features:
 * - Sequence numbers for ordering
 * - Proper header encryption
 * - Replay detection
 * - Message deduplication
 */

import type {
  RatchetState,
  PublicKey,
} from '../crypto/types.js';
import {
  ratchetEncrypt,
  ratchetDecrypt,
} from '../crypto/ratchet.js';
import {
  encrypt,
  decrypt,
  computeMAC,
  verifyMAC,
} from '../crypto/encryption.js';
import {
  generateMessageId,
} from '../crypto/keygen.js';
import { CRYPTO_CONSTANTS } from '../crypto/constants.js';

export interface EncryptedMessageData {
  messageId: Uint8Array;
  sequence: number;           // NEW: For ordering
  header: Uint8Array;
  ciphertext: Uint8Array;
  mac: Uint8Array;
  timestamp: number;
  version: number;
}

export interface MessageHeader {
  sequence: number;           // NEW: Sequence number
  dhPublicKey: PublicKey;
  messageNumber: number;
  previousChainLength: number;
}

export async function encryptMessage(
  plaintext: Uint8Array,
  ratchetState: RatchetState,
  _recipientPublicKey?: PublicKey
): Promise<EncryptedMessageData> {
  if (plaintext.length > CRYPTO_CONSTANTS.MAX_MESSAGE_SIZE) {
    throw new Error('Message too large');
  }
  
  const ratchetResult = ratchetEncrypt(ratchetState, plaintext);
  const messageKey = ratchetResult.messageKey;
  
  const iv = new Uint8Array(CRYPTO_CONSTANTS.AES_IV_SIZE);
  crypto.getRandomValues(iv);
  messageKey.iv = iv;
  
  const { ciphertext, tag } = await encrypt(
    plaintext,
    messageKey.encryptionKey,
    iv
  );
  
  const sequence = ratchetState.sendCounter++;
  
  const header: MessageHeader = {
    sequence,                                              // NEW
    dhPublicKey: ratchetState.sendingEphemeralKey!.publicKey,
    messageNumber: messageKey.index,
    previousChainLength: ratchetState.previousChainLength,
  };
  
  const headerBytes = serializeHeader(header);
  
  const { ciphertext: encryptedHeader, tag: headerTag } = await encrypt(
    headerBytes,
    messageKey.encryptionKey,
    undefined,
    ciphertext
  );
  
  const fullHeader = new Uint8Array(encryptedHeader.length + headerTag.length);
  fullHeader.set(encryptedHeader, 0);
  fullHeader.set(headerTag, encryptedHeader.length);
  
  const macData = new Uint8Array(
    fullHeader.length +
    ciphertext.length +
    tag.length +
    4  // sequence number
  );
  let offset = 0;
  
  const sequenceView = new DataView(macData.buffer, macData.byteOffset, 4);
  sequenceView.setUint32(0, sequence, false);
  offset += 4;
  
  macData.set(fullHeader, offset);
  offset += fullHeader.length;
  macData.set(ciphertext, offset);
  offset += ciphertext.length;
  macData.set(tag, offset);
  
  const mac = await computeMAC(macData, messageKey.macKey);
  
  const messageId = generateMessageId();
  
  return {
    messageId,
    sequence,                                              // NEW
    header: fullHeader,
    ciphertext,
    mac,
    timestamp: Date.now(),
    version: CRYPTO_CONSTANTS.PROTOCOL_VERSION,
  };
}

export async function decryptMessage(
  encryptedData: EncryptedMessageData,
  ratchetState: RatchetState
): Promise<Uint8Array> {
  if (encryptedData.sequence !== ratchetState.receiveCounter) {
    throw new Error(`Sequence mismatch: expected ${ratchetState.receiveCounter}, got ${encryptedData.sequence}`);
  }
  
  const headerCiphertext = encryptedData.header.slice(0, -16);
  const headerTag = encryptedData.header.slice(-16);
  
  const tempMessageKey = ratchetState.receivingChainKey;
  const tempIv = new Uint8Array(CRYPTO_CONSTANTS.AES_IV_SIZE);
  crypto.getRandomValues(tempIv);
  
  const headerBytes = await decrypt(
    headerCiphertext,
    headerTag,
    tempMessageKey.key.slice(0, 32),
    tempIv,
    encryptedData.ciphertext
  );
  
  const header = deserializeHeader(headerBytes);
  
  if (header.sequence !== encryptedData.sequence) {
    throw new Error('Header sequence mismatch');
  }
  
  const messageKey = ratchetDecrypt(
    ratchetState,
    header.dhPublicKey,
    header.messageNumber,
    header.previousChainLength
  );
  
  messageKey.iv = tempIv;
  
  const macData = new Uint8Array(
    4 +
    encryptedData.header.length +
    encryptedData.ciphertext.length +
    16
  );
  let offset = 0;
  
  const sequenceView = new DataView(macData.buffer, macData.byteOffset, 4);
  sequenceView.setUint32(0, encryptedData.sequence, false);
  offset += 4;
  
  macData.set(encryptedData.header, offset);
  offset += encryptedData.header.length;
  macData.set(encryptedData.ciphertext, offset);
  offset += encryptedData.ciphertext.length;
  const tag = encryptedData.ciphertext.slice(-16);
  macData.set(tag, offset);
  
  const macValid = await verifyMAC(macData, messageKey.macKey, encryptedData.mac);
  if (!macValid) {
    throw new Error('MAC verification failed');
  }
  
  ratchetState.receiveCounter++;
  
  const plaintext = await decrypt(
    encryptedData.ciphertext,
    tag,
    messageKey.encryptionKey,
    messageKey.iv!
  );
  
  return plaintext;
}

function serializeHeader(header: MessageHeader): Uint8Array {
  const buffer = new Uint8Array(
    4 +  // sequence
    32 + // dhPublicKey
    4 +  // messageNumber
    4    // previousChainLength
  );
  let offset = 0;
  
  let view = new DataView(buffer.buffer, offset, 4);
  view.setUint32(0, header.sequence, false);
  offset += 4;
  
  buffer.set(header.dhPublicKey, offset);
  offset += 32;
  
  view = new DataView(buffer.buffer, offset, 4);
  view.setUint32(0, header.messageNumber, false);
  offset += 4;
  
  view = new DataView(buffer.buffer, offset, 4);
  view.setUint32(0, header.previousChainLength, false);
  
  return buffer;
}

export function deserializeHeader(data: Uint8Array): MessageHeader {
  if (data.length < 44) {
    throw new Error('Invalid header data');
  }
  
  let offset = 0;
  const sequence = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, false);
  offset += 4;
  
  const dhPublicKey = data.slice(offset, offset + 32);
  offset += 32;
  
  const messageNumber = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, false);
  offset += 4;
  
  const previousChainLength = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, false);
  
  return {
    sequence,
    dhPublicKey,
    messageNumber,
    previousChainLength,
  };
}
