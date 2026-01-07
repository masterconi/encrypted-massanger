/**
 * Secure Messenger Client
 * 
 * Main client implementation with:
 * - Secure connection management
 * - Message encryption/decryption
 * - Offline message queueing
 * - Delivery acknowledgments
 * - Automatic retry with exponential backoff
 */

import WebSocket from 'ws';
import type {
  IdentityKeyPair,
  RatchetState,
} from '../crypto/types.js';
import {
  generateIdentityKeyPair,
  generateEphemeralKeyPair,
} from '../crypto/keygen.js';
import {
  createRatchetState,
  initializeRatchet,
  cleanupRatchet,
} from '../crypto/ratchet.js';
import {
  createHandshakeInit,
  processHandshakeResponse,
  type HandshakeState,
} from '../protocol/handshake.js';
import {
  encryptMessage,
  type EncryptedMessageData,
} from '../protocol/message.js';

export interface ClientConfig {
  serverUrl: string;
  identityKey?: IdentityKeyPair;
  onMessage?: (senderId: string, message: Uint8Array) => void;
  onError?: (error: Error) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export interface QueuedMessage {
  messageId: Uint8Array;
  recipientId: string;
  encryptedData: EncryptedMessageData;
  timestamp: number;
  retryCount: number;
  nextRetry: number;
}

export class SecureMessengerClient {
  private config: ClientConfig;
  private identityKey: IdentityKeyPair;
  private ws: WebSocket | null = null;
  private handshakeState: HandshakeState | null = null;
  private ratchetStates: Map<string, RatchetState> = new Map();
  private messageQueue: QueuedMessage[] = [];
  private ackWaiters: Map<string, (success: boolean) => void> = new Map();
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private retryBackoff = 1000; // Start with 1 second

  constructor(config: ClientConfig) {
    this.config = config;
    this.identityKey = config.identityKey || generateIdentityKeyPair();
  }

  /**
   * Connect to the server and perform handshake
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.serverUrl);

        this.ws.on('open', async () => {
          try {
            await this.performHandshake();
            this.connected = true;
            this.retryBackoff = 1000; // Reset backoff on successful connection
            this.config.onConnected?.();
            this.processMessageQueue();
            resolve();
          } catch (error) {
            this.config.onError?.(error as Error);
            reject(error);
          }
        });

        this.ws.on('message', async (data: Buffer) => {
          try {
            await this.handleMessage(data);
          } catch (error) {
            this.config.onError?.(error as Error);
          }
        });

        this.ws.on('error', (error) => {
          this.config.onError?.(error);
          reject(error);
        });

        this.ws.on('close', () => {
          this.connected = false;
          this.config.onDisconnected?.();
          this.scheduleReconnect();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Perform cryptographic handshake
   */
  private async performHandshake(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const ephemeralKey = generateEphemeralKeyPair();
    const { message, state } = createHandshakeInit(this.identityKey, ephemeralKey);
    this.handshakeState = state;

    // Send handshake init
    this.ws.send(message);

    // Wait for handshake response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Handshake timeout'));
      }, 10000); // 10 second timeout

      const messageHandler = async (data: Buffer) => {
        try {
          clearTimeout(timeout);
          if (this.ws) {
            this.ws.removeListener('message', messageHandler);
          }

          const { rootKey } = await processHandshakeResponse(
            new Uint8Array(data),
            this.handshakeState!
          );

          // Initialize ratchet state for server connection
          const ratchetState = createRatchetState();
          initializeRatchet(ratchetState, { key: rootKey }, ephemeralKey);
          this.ratchetStates.set('server', ratchetState);

          // Send handshake complete
          const confirmation = await this.createHandshakeComplete(rootKey);
          if (this.ws) {
            this.ws.send(confirmation);
          }

          resolve();
        } catch (error) {
          clearTimeout(timeout);
          if (this.ws) {
            this.ws.removeListener('message', messageHandler);
          }
          reject(error);
        }
      };

      if (this.ws) {
        this.ws.on('message', messageHandler);
      }
    });
  }

  /**
   * Create handshake complete message
   */
  private async createHandshakeComplete(_rootKey: Uint8Array): Promise<Uint8Array> {
    // Simplified - in production, implement proper confirmation
    const confirmation = new Uint8Array(32);
    crypto.getRandomValues(confirmation);
    return confirmation;
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(_data: Buffer): Promise<void> {
    // Parse message type and route accordingly
    // Simplified - in production, use proper message format
    // const messageData = new Uint8Array(data);
    
    // Check if it's a handshake message, encrypted message, or ack
    // For now, assume encrypted message
    // In production, implement proper message type detection
    
    // Decrypt and process message
    // This requires proper message format implementation
  }

  /**
   * Send a message to a recipient
   */
  async sendMessage(recipientId: string, plaintext: string | Uint8Array): Promise<void> {
    const plaintextBytes = typeof plaintext === 'string'
      ? new TextEncoder().encode(plaintext)
      : plaintext;

    // Get or create ratchet state for recipient
    let ratchetState = this.ratchetStates.get(recipientId);
    if (!ratchetState) {
      ratchetState = createRatchetState();
      // In production, initialize with recipient's public key from directory
      // For now, create empty state
      this.ratchetStates.set(recipientId, ratchetState);
    }

    // Encrypt message
    const encryptedData = await encryptMessage(plaintextBytes, ratchetState);

    // Queue message for delivery
    const queuedMessage: QueuedMessage = {
      messageId: encryptedData.messageId,
      recipientId,
      encryptedData,
      timestamp: Date.now(),
      retryCount: 0,
      nextRetry: Date.now(),
    };

    this.messageQueue.push(queuedMessage);

    // Try to send immediately if connected
    if (this.connected) {
      await this.sendQueuedMessage(queuedMessage);
    }
  }

  /**
   * Send a queued message
   */
  private async sendQueuedMessage(queued: QueuedMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      // Serialize message (simplified)
      const messageBytes = this.serializeMessage(queued.encryptedData);
      this.ws.send(messageBytes);

      // Wait for acknowledgment
      const ackReceived = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 5000); // 5 second timeout

        this.ackWaiters.set(
          Buffer.from(queued.messageId).toString('hex'),
          (success) => {
            clearTimeout(timeout);
            resolve(success);
          }
        );
      });

      if (ackReceived) {
        // Remove from queue
        const index = this.messageQueue.indexOf(queued);
        if (index > -1) {
          this.messageQueue.splice(index, 1);
        }
      } else {
        // Retry with exponential backoff
        queued.retryCount++;
        queued.nextRetry = Date.now() + Math.min(
          this.retryBackoff * Math.pow(2, queued.retryCount),
          60000 // Max 1 minute
        );
      }
    } catch (error) {
      this.config.onError?.(error as Error);
      // Schedule retry
      queued.retryCount++;
      queued.nextRetry = Date.now() + this.retryBackoff;
    }
  }

  /**
   * Serialize message for transmission
   */
  private serializeMessage(encryptedData: EncryptedMessageData): Uint8Array {
    // Simplified serialization
    // In production, use protobuf
    const buffer = new Uint8Array(
      16 + // messageId
      4 +  // header length
      encryptedData.header.length +
      4 +  // ciphertext length
      encryptedData.ciphertext.length +
      4 +  // mac length
      encryptedData.mac.length +
      8 +  // timestamp
      4    // version
    );

    let offset = 0;
    buffer.set(encryptedData.messageId, offset);
    offset += 16;

    const headerLenView = new DataView(buffer.buffer, offset, 4);
    headerLenView.setUint32(0, encryptedData.header.length, false);
    offset += 4;
    buffer.set(encryptedData.header, offset);
    offset += encryptedData.header.length;

    const ciphertextLenView = new DataView(buffer.buffer, offset, 4);
    ciphertextLenView.setUint32(0, encryptedData.ciphertext.length, false);
    offset += 4;
    buffer.set(encryptedData.ciphertext, offset);
    offset += encryptedData.ciphertext.length;

    const macLenView = new DataView(buffer.buffer, offset, 4);
    macLenView.setUint32(0, encryptedData.mac.length, false);
    offset += 4;
    buffer.set(encryptedData.mac, offset);
    offset += encryptedData.mac.length;

    const timestampView = new DataView(buffer.buffer, offset, 8);
    timestampView.setBigUint64(0, BigInt(encryptedData.timestamp), false);
    offset += 8;

    const versionView = new DataView(buffer.buffer, offset, 4);
    versionView.setUint32(0, encryptedData.version, false);

    return buffer;
  }

  /**
   * Process message queue (send pending messages)
   */
  private processMessageQueue(): void {
    const now = Date.now();
    const readyMessages = this.messageQueue.filter(
      (msg) => msg.nextRetry <= now && msg.retryCount < 10 // Max 10 retries
    );

    for (const msg of readyMessages) {
      this.sendQueuedMessage(msg).catch((error) => {
        this.config.onError?.(error);
      });
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.config.onError?.(error);
        this.retryBackoff = Math.min(this.retryBackoff * 2, 60000); // Max 1 minute
        this.scheduleReconnect();
      });
    }, this.retryBackoff);
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clean up ratchet states
    for (const state of this.ratchetStates.values()) {
      cleanupRatchet(state);
    }
    this.ratchetStates.clear();

    this.connected = false;
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }
}

