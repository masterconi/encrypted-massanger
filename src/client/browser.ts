/**
 * Browser-compatible client entry point
 * Exports the client for use in web applications
 */

import { SecureMessengerClient } from './client.js';
import type { ClientConfig } from './client.js';
import { BrowserWebSocket } from './browser-websocket.js';

// Re-export for browser usage
export { SecureMessengerClient, BrowserWebSocket };
export type { ClientConfig };

// Export crypto utilities for browser use
export {
  generateIdentityKeyPair,
  generateEphemeralKeyPair,
} from '../crypto/keygen.js';

export type {
  IdentityKeyPair,
} from '../crypto/types.js';
