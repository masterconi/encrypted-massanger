/**
 * Server entry point with persistent identity
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { SecureMessengerServer } from './server.js';
import { generateIdentityKeyPair } from '../crypto/keygen.js';
import type { IdentityKeyPair } from '../crypto/types.js';

function loadOrGenerateServerIdentity(): IdentityKeyPair {
  const keyPath = process.env.SERVER_KEY_PATH || './data/server-identity.key';
  
  try {
    if (existsSync(keyPath)) {
      console.log('Loading server identity from', keyPath);
      const keyData = JSON.parse(readFileSync(keyPath, 'utf8'));
      
      if (!keyData.publicKey || !keyData.privateKey) {
        throw new Error('Invalid key file format');
      }
      
      return {
        publicKey: new Uint8Array(keyData.publicKey),
        privateKey: new Uint8Array(keyData.privateKey),
      };
    }
  } catch (error) {
    console.error('Failed to load server identity:', error);
    console.log('Generating new server identity...');
  }
  
  const serverKey = generateIdentityKeyPair();
  
  try {
    const keyData = {
      publicKey: Array.from(serverKey.publicKey),
      privateKey: Array.from(serverKey.privateKey),
      createdAt: new Date().toISOString(),
    };
    
    const dir = keyPath.substring(0, keyPath.lastIndexOf('/') || keyPath.lastIndexOf('\\'));
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(keyPath, JSON.stringify(keyData, null, 2), {
      mode: 0o600,
    });
    
    console.log('Server identity saved to', keyPath);
    console.log('Server public key:', Buffer.from(serverKey.publicKey).toString('hex'));
  } catch (error) {
    console.error('Failed to save server identity:', error);
    console.warn('Server identity will not persist across restarts!');
  }
  
  return serverKey;
}

const serverIdentityKey = loadOrGenerateServerIdentity();

const server = new SecureMessengerServer({
  port: parseInt(process.env.PORT || '8080', 10),
  host: process.env.HOST || '0.0.0.0',
  serverIdentityKey,
  maxSessions: parseInt(process.env.MAX_SESSIONS || '10000', 10),
  maxStoredMessages: parseInt(process.env.MAX_STORED_MESSAGES || '10000', 10),
  handshakeRateLimitPerMin: parseInt(process.env.HANDSHAKE_RATE_LIMIT || '10', 10),
});

server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  server.stop().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  server.stop().then(() => process.exit(1));
});
