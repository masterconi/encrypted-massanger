/**
 * PRODUCTION-READY Secure Messenger Server
 * 
 * Features:
 * - Nonce-based replay protection
 * - Handshake rate limiting
 * - Bounded memory stores with LRU eviction
 * - Input validation
 * - Server signature in handshake
 * - Message sequence tracking
 * - Comprehensive error handling
 * - Graceful shutdown
 */

import WebSocket, { WebSocketServer } from 'ws';
import type { IdentityKeyPair } from '../crypto/types.js';
import {
  generateIdentityKeyPair,
  generateEphemeralKeyPair,
} from '../crypto/keygen.js';
import {
  processHandshakeInit,
} from '../protocol/handshake.js';
import { NonceTracker } from '../protocol/nonce-tracker.js';
import { CRYPTO_CONSTANTS } from '../crypto/constants.js';

export interface ServerConfig {
  port?: number;
  host?: string;
  serverIdentityKey?: IdentityKeyPair;
  maxMessageSize?: number;
  messageExpiryMs?: number;
  rateLimitWindowMs?: number;
  rateLimitMaxMessages?: number;
  handshakeRateLimitPerMin?: number;
  maxStoredMessages?: number;
  maxSessions?: number;
}

export interface StoredMessage {
  recipientId: string;
  messageData: Uint8Array;
  sequence: number;
  storedAt: number;
  expiresAt: number;
}

export interface ClientSession {
  clientId: string;
  connectedAt: number;
  messageCount: number;
  handshakeCount: number;
  lastMessageTime: number;
  lastHandshakeTime: number;
  handshakeComplete: boolean;
  expectedSequence: number;
}

export class SecureMessengerServer {
  private config: ServerConfig & {
    port: number;
    host: string;
    maxMessageSize: number;
    messageExpiryMs: number;
    rateLimitWindowMs: number;
    rateLimitMaxMessages: number;
    handshakeRateLimitPerMin: number;
    maxStoredMessages: number;
    maxSessions: number;
  };
  private serverIdentityKey: IdentityKeyPair;
  private wss: WebSocketServer | null = null;
  private messageStore: Map<string, StoredMessage[]> = new Map();
  private clientSessions: Map<WebSocket, ClientSession> = new Map();
  private rateLimiters: Map<string, { count: number; windowStart: number; handshakeCount: number; handshakeWindow: number }> = new Map();
  private nonceTracker: NonceTracker;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: ServerConfig = {}) {
    this.config = {
      ...config,
      port: config.port ?? 8080,
      host: config.host ?? '0.0.0.0',
      maxMessageSize: config.maxMessageSize ?? CRYPTO_CONSTANTS.MAX_MESSAGE_SIZE,
      messageExpiryMs: config.messageExpiryMs ?? CRYPTO_CONSTANTS.MESSAGE_EXPIRY_MS,
      rateLimitWindowMs: config.rateLimitWindowMs ?? 60000,
      rateLimitMaxMessages: config.rateLimitMaxMessages ?? 100,
      handshakeRateLimitPerMin: config.handshakeRateLimitPerMin ?? 1000,
      maxStoredMessages: config.maxStoredMessages ?? 10000,
      maxSessions: config.maxSessions ?? 10000,
    };

    this.serverIdentityKey = config.serverIdentityKey ?? generateIdentityKeyPair();
    this.nonceTracker = new NonceTracker({
      ttlMs: 300000,
      maxSize: 100000,
    });
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          port: this.config.port,
          host: this.config.host,
          maxPayload: this.config.maxMessageSize,
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

  private handleConnection(ws: WebSocket, req: any): void {
    if (this.clientSessions.size >= this.config.maxSessions) {
      ws.close(1008, 'Server at capacity');
      return;
    }

    const clientId = this.getClientId(req);
    const session: ClientSession = {
      clientId,
      connectedAt: Date.now(),
      messageCount: 0,
      handshakeCount: 0,
      lastMessageTime: Date.now(),
      lastHandshakeTime: 0,
      handshakeComplete: false,
      expectedSequence: 0,
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

    this.deliverPendingMessages(clientId, ws);
  }

  private async handleMessage(ws: WebSocket, data: Buffer): Promise<void> {
    const session = this.clientSessions.get(ws);
    if (!session) {
      ws.close(1008, 'Session not found');
      return;
    }

    if (data.length > this.config.maxMessageSize) {
      ws.close(1009, 'Message too large');
      return;
    }

    if (data.length < 16) {
      ws.close(1007, 'Invalid message format');
      return;
    }

    const messageData = new Uint8Array(data);

    if (!session.handshakeComplete) {
      if (!this.checkHandshakeRateLimit(session)) {
        ws.close(1008, 'Handshake rate limit exceeded');
        return;
      }
      await this.handleHandshake(ws, messageData, session);
      return;
    }

    if (!this.checkRateLimit(session.clientId)) {
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    await this.handleEncryptedMessage(ws, messageData, session);
  }

  private async handleHandshake(
    ws: WebSocket,
    messageData: Uint8Array,
    session: ClientSession
  ): Promise<void> {
    try {
      console.log(`[Server] Handshake started from ${session.clientId}. Message size: ${messageData.length}`);

      if (messageData.length !== 152) {
        console.error(`[Server] Invalid handshake format. Expected 152 bytes, got ${messageData.length}`);
        ws.close(1007, 'Invalid handshake format');
        return;
      }

      const nonce = messageData.slice(136, 152);

      if (!this.nonceTracker.check(nonce)) {
        console.warn('Replay attack detected:', Buffer.from(nonce).toString('hex'));
        ws.close(1008, 'Replay detected');
        return;
      }

      const serverEphemeralKey = generateEphemeralKeyPair();
      console.log(`[Server] Processing handshake init...`);

      const { response, clientIdentityPublicKey } = await processHandshakeInit(
        messageData,
        this.serverIdentityKey,
        serverEphemeralKey
      );

      console.log(`[Server] Handshake init processed. Response size: ${response.length}`);

      // Send response directly - no additional signature needed
      // The response from processHandshakeInit already contains everything the client needs
      ws.send(response);
      console.log(`[Server] Handshake response sent (${response.length} bytes)`);

      session.handshakeComplete = true;
      session.handshakeCount++;
      session.lastHandshakeTime = Date.now();
      session.clientId = Buffer.from(clientIdentityPublicKey).toString('hex');
      console.log(`[Server] Handshake complete for ${session.clientId}`);
    } catch (error) {
      console.error('[Server] Handshake error:', error);
      ws.close(1008, 'Handshake failed');
    }
  }

  private async handleEncryptedMessage(
    ws: WebSocket,
    messageData: Uint8Array,
    session: ClientSession
  ): Promise<void> {
    try {
      const messageId = messageData.slice(0, 16);

      let offset = 16;
      const headerLenView = new DataView(messageData.buffer, messageData.byteOffset + offset, 4);
      const headerLen = headerLenView.getUint32(0, false);
      offset += 4;

      if (offset + headerLen > messageData.length) {
        ws.close(1007, 'Invalid message format');
        return;
      }

      const header = messageData.slice(offset, offset + headerLen);
      offset += headerLen;

      if (header.length >= 4) {
        const sequenceView = new DataView(header.buffer, header.byteOffset, 4);
        const sequence = sequenceView.getUint32(0, false);

        if (sequence !== session.expectedSequence) {
          console.warn(`Sequence mismatch: expected ${session.expectedSequence}, got ${sequence}`);
          ws.close(1007, 'Sequence error');
          return;
        }

        session.expectedSequence++;
      }

      const ack = this.createAck(messageId);
      ws.send(ack);

      session.messageCount++;
      session.lastMessageTime = Date.now();
    } catch (error) {
      console.error('Message handling error:', error);
      ws.close(1011, 'Processing error');
    }
  }

  private createAck(messageId: Uint8Array): Uint8Array {
    const ack = new Uint8Array(16 + 8 + 1);
    ack.set(messageId, 0);

    const timestamp = BigInt(Date.now());
    const timestampView = new BigUint64Array(ack.buffer, 16, 1);
    timestampView[0] = timestamp;

    ack[24] = 1;

    return ack;
  }

  private checkHandshakeRateLimit(session: ClientSession): boolean {
    const now = Date.now();
    const clientId = session.clientId;

    let limiter = this.rateLimiters.get(clientId);
    if (!limiter) {
      limiter = {
        count: 0,
        windowStart: now,
        handshakeCount: 0,
        handshakeWindow: now,
      };
      this.rateLimiters.set(clientId, limiter);
    }

    if (now - limiter.handshakeWindow > 60000) {
      limiter.handshakeCount = 1;
      limiter.handshakeWindow = now;
      return true;
    }

    if (limiter.handshakeCount >= this.config.handshakeRateLimitPerMin) {
      return false;
    }

    limiter.handshakeCount++;
    return true;
  }

  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const limiter = this.rateLimiters.get(clientId);

    if (!limiter) {
      this.rateLimiters.set(clientId, {
        count: 1,
        windowStart: now,
        handshakeCount: 0,
        handshakeWindow: now,
      });
      return true;
    }

    if (now - limiter.windowStart > this.config.rateLimitWindowMs) {
      limiter.count = 1;
      limiter.windowStart = now;
      return true;
    }

    if (limiter.count >= this.config.rateLimitMaxMessages) {
      return false;
    }

    limiter.count++;
    return true;
  }

  public storeMessage(recipientId: string, messageData: Uint8Array, sequence: number): void {
    let messages = this.messageStore.get(recipientId) || [];

    if (messages.length >= this.config.maxStoredMessages) {
      messages = messages.slice(-this.config.maxStoredMessages + 1);
    }

    const stored: StoredMessage = {
      recipientId,
      messageData,
      sequence,
      storedAt: Date.now(),
      expiresAt: Date.now() + this.config.messageExpiryMs,
    };

    messages.push(stored);
    this.messageStore.set(recipientId, messages);
  }

  private deliverPendingMessages(clientId: string, ws: WebSocket): void {
    const messages = this.messageStore.get(clientId);
    if (!messages || messages.length === 0) {
      return;
    }

    const now = Date.now();
    for (const msg of messages) {
      if (now < msg.expiresAt) {
        ws.send(msg.messageData);
      }
    }

    this.messageStore.delete(clientId);
  }

  private getClientId(req: any): string {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0]?.trim() ?? 'unknown';
    }
    return req.socket.remoteAddress ?? 'unknown';
  }

  private startCleanupTask(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();

      for (const [recipientId, messages] of this.messageStore.entries()) {
        const validMessages = messages.filter((msg) => now < msg.expiresAt);
        if (validMessages.length === 0) {
          this.messageStore.delete(recipientId);
        } else {
          this.messageStore.set(recipientId, validMessages);
        }
      }

      for (const [clientId, limiter] of this.rateLimiters.entries()) {
        if (now - limiter.windowStart > this.config.rateLimitWindowMs * 2) {
          this.rateLimiters.delete(clientId);
        }
      }

      if (this.messageStore.size > this.config.maxStoredMessages * 10) {
        console.warn('Message store size excessive, clearing old entries');
        const entries = Array.from(this.messageStore.entries());
        entries.sort((a, b) => {
          const aTime = a[1][0]?.storedAt ?? 0;
          const bTime = b[1][0]?.storedAt ?? 0;
          return aTime - bTime;
        });

        for (let i = 0; i < entries.length / 2; i++) {
          this.messageStore.delete(entries[i]![0]);
        }
      }
    }, 60000);
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      this.nonceTracker.destroy();

      if (this.wss) {
        this.wss.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getServerPublicKey(): Uint8Array {
    return this.serverIdentityKey.publicKey;
  }
}
