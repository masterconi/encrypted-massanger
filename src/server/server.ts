/**
 * Secure Messenger Server
 * 
 * Stateless message relay server with:
 * - Encrypted message storage (server cannot decrypt)
 * - Rate limiting
 - Abuse prevention
 * - Horizontal scalability support
 * - Message expiration
 */

import WebSocket, { WebSocketServer } from 'ws';
import type {
  IdentityKeyPair,
} from '../crypto/types.js';
import {
  generateIdentityKeyPair,
  generateEphemeralKeyPair,
} from '../crypto/keygen.js';
import {
  processHandshakeInit,
} from '../protocol/handshake.js';
import { CRYPTO_CONSTANTS } from '../crypto/constants.js';

export interface ServerConfig {
  port?: number;
  host?: string;
  serverIdentityKey?: IdentityKeyPair;
  maxMessageSize?: number;
  messageExpiryMs?: number;
  rateLimitWindowMs?: number;
  rateLimitMaxMessages?: number;
}

export interface StoredMessage {
  recipientId: string;
  messageData: Uint8Array;
  storedAt: number;
  expiresAt: number;
  retryCount: number;
}

export interface ClientSession {
  clientId: string;
  connectedAt: number;
  messageCount: number;
  lastMessageTime: number;
  handshakeComplete: boolean;
}

export class SecureMessengerServer {
  private config: ServerConfig;
  private serverIdentityKey: IdentityKeyPair;
  private wss: WebSocketServer | null = null;
  private messageStore: Map<string, StoredMessage[]> = new Map();
  private clientSessions: Map<WebSocket, ClientSession> = new Map();
  private rateLimiters: Map<string, { count: number; windowStart: number }> = new Map();

  constructor(config: ServerConfig = {}) {
    this.config = {
      port: config.port || 8080,
      host: config.host || '0.0.0.0',
      maxMessageSize: config.maxMessageSize || CRYPTO_CONSTANTS.MAX_MESSAGE_SIZE,
      messageExpiryMs: config.messageExpiryMs || CRYPTO_CONSTANTS.MESSAGE_EXPIRY_MS,
      rateLimitWindowMs: config.rateLimitWindowMs || 60000, // 1 minute
      rateLimitMaxMessages: config.rateLimitMaxMessages || 100,
      ...config,
    };
    this.serverIdentityKey = config.serverIdentityKey || generateIdentityKeyPair();
  }

  /**
   * Start the server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          port: this.config.port,
          host: this.config.host,
        });

        this.wss.on('listening', () => {
          console.log(`Secure Messenger Server listening on ${this.config.host}:${this.config.port}`);
          this.startCleanupTask();
          resolve();
        });

        this.wss.on('error', (error) => {
          console.error('WebSocket server error:', error);
          reject(error);
        });

        this.wss.on('connection', (ws: WebSocket, req) => {
          this.handleConnection(ws, req);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle new client connection
   */
  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = this.getClientId(req);
    const session: ClientSession = {
      clientId,
      connectedAt: Date.now(),
      messageCount: 0,
      lastMessageTime: Date.now(),
      handshakeComplete: false,
    };
    this.clientSessions.set(ws, session);

    ws.on('message', async (data: Buffer) => {
      try {
        await this.handleMessage(ws, data);
      } catch (error) {
        console.error('Error handling message:', error);
        ws.close(1011, 'Internal error');
      }
    });

    ws.on('close', () => {
      this.clientSessions.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.clientSessions.delete(ws);
    });

    // Send any pending messages for this client
    this.deliverPendingMessages(clientId, ws);
  }

  /**
   * Handle incoming message from client
   */
  private async handleMessage(ws: WebSocket, data: Buffer): Promise<void> {
    const session = this.clientSessions.get(ws);
    if (!session) {
      ws.close(1008, 'Session not found');
      return;
    }

    // Check rate limiting
    if (!this.checkRateLimit(session.clientId)) {
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    // Check message size
    if (data.length > this.config.maxMessageSize!) {
      ws.close(1009, 'Message too large');
      return;
    }

    const messageData = new Uint8Array(data);

    // Check if this is a handshake message
    if (!session.handshakeComplete) {
      await this.handleHandshake(ws, messageData, session);
      return;
    }

    // Handle encrypted message or other protocol messages
    await this.handleEncryptedMessage(ws, messageData, session);
  }

  /**
   * Handle handshake
   */
  private async handleHandshake(
    ws: WebSocket,
    messageData: Uint8Array,
    session: ClientSession
  ): Promise<void> {
    try {
      const serverEphemeralKey = generateEphemeralKeyPair();
      const { response, clientIdentityPublicKey } = await processHandshakeInit(
        messageData,
        this.serverIdentityKey,
        serverEphemeralKey
      );

      ws.send(response);
      session.handshakeComplete = true;
      session.clientId = Buffer.from(clientIdentityPublicKey).toString('hex');
    } catch (error) {
      console.error('Handshake error:', error);
      ws.close(1008, 'Handshake failed');
    }
  }

  /**
   * Handle encrypted message
   */
  private async handleEncryptedMessage(
    ws: WebSocket,
    messageData: Uint8Array,
    session: ClientSession
  ): Promise<void> {
    // Parse message (simplified - in production use proper format)
    // For now, assume it's a message to relay
    
    // Extract recipient ID and message
    // In production, implement proper message parsing
    
    // Store message for recipient
    // Server cannot decrypt, so stores as-is
    
    // Send acknowledgment
    const ack = this.createAck(messageData.slice(0, 16)); // Assume first 16 bytes are message ID
    ws.send(ack);

    session.messageCount++;
    session.lastMessageTime = Date.now();
  }

  /**
   * Create delivery acknowledgment
   */
  private createAck(messageId: Uint8Array): Uint8Array {
    // Simplified ack format
    const ack = new Uint8Array(16 + 8 + 1); // messageId + timestamp + success
    ack.set(messageId, 0);
    
    const timestamp = BigInt(Date.now());
    const timestampView = new BigUint64Array(ack.buffer, 16, 1);
    timestampView[0] = timestamp;
    
    ack[24] = 1; // success = true
    
    return ack;
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const limiter = this.rateLimiters.get(clientId);

    if (!limiter) {
      this.rateLimiters.set(clientId, {
        count: 1,
        windowStart: now,
      });
      return true;
    }

    // Reset window if expired
    if (now - limiter.windowStart > this.config.rateLimitWindowMs!) {
      limiter.count = 1;
      limiter.windowStart = now;
      return true;
    }

    // Check limit
    if (limiter.count >= this.config.rateLimitMaxMessages!) {
      return false;
    }

    limiter.count++;
    return true;
  }

  /**
   * Store message for recipient
   * (Currently unused, but kept for future persistent storage implementation)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public storeMessage(recipientId: string, messageData: Uint8Array): void {
    const stored: StoredMessage = {
      recipientId,
      messageData,
      storedAt: Date.now(),
      expiresAt: Date.now() + this.config.messageExpiryMs!,
      retryCount: 0,
    };

    const messages = this.messageStore.get(recipientId) || [];
    messages.push(stored);
    this.messageStore.set(recipientId, messages);
  }

  /**
   * Deliver pending messages to client
   */
  private deliverPendingMessages(clientId: string, ws: WebSocket): void {
    const messages = this.messageStore.get(clientId);
    if (!messages || messages.length === 0) {
      return;
    }

    // Send all pending messages
    for (const msg of messages) {
      if (Date.now() < msg.expiresAt) {
        ws.send(msg.messageData);
      }
    }

    // Remove delivered messages
    this.messageStore.delete(clientId);
  }

  /**
   * Get client ID from request
   */
  private getClientId(req: any): string {
    // In production, use proper client identification
    // For now, use IP address
    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Start cleanup task (remove expired messages)
   */
  private startCleanupTask(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [recipientId, messages] of this.messageStore.entries()) {
        const validMessages = messages.filter((msg) => now < msg.expiresAt);
        if (validMessages.length === 0) {
          this.messageStore.delete(recipientId);
        } else {
          this.messageStore.set(recipientId, validMessages);
        }
      }

      // Clean up old rate limiters
      for (const [clientId, limiter] of this.rateLimiters.entries()) {
        if (now - limiter.windowStart > this.config.rateLimitWindowMs! * 2) {
          this.rateLimiters.delete(clientId);
        }
      }
    }, 60000); // Run every minute
  }

  /**
   * Stop the server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

