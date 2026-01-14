// Test full client-server connection
// Import from dist, NOT from the browser bundle
import { SecureMessengerClient, SecureMessengerServer, generateIdentityKeyPair } from './dist/index.js';
import WebSocket from 'ws';

console.log('Testing full client-server connection...\n');

async function test() {
  // Start server
  console.log('Starting server...');
  const server = new SecureMessengerServer({ port: 8081, host: 'localhost' });
  await server.start();
  console.log('✓ Server started on localhost:8081\n');

  // Generate client identity
  console.log('Generating client identity...');
  const clientIdentity = generateIdentityKeyPair();
  console.log('✓ Generated');
  console.log('  Public key size:', clientIdentity.publicKey.length);
  console.log('  Private key size:', clientIdentity.privateKey.length);

  // Simulate localStorage serialization
  console.log('\nSimulating localStorage serialization...');
  const serialized = {
    publicKey: Array.from(clientIdentity.publicKey),
    privateKey: Array.from(clientIdentity.privateKey),
  };
  const deserialized = {
    publicKey: new Uint8Array(serialized.publicKey),
    privateKey: new Uint8Array(serialized.privateKey),
  };
  console.log('✓ Deserialized');
  console.log('  Public key size:', deserialized.publicKey.length);
  console.log('  Private key size:', deserialized.privateKey.length);

  // Create client
  console.log('\nCreating client with deserialized key...');
  const client = new SecureMessengerClient({
    serverUrl: 'ws://localhost:8081',
    identityKey: deserialized,
    onConnected: () => {
      console.log('✓ Client connected!');
    },
    onError: (error) => {
      console.error('✗ Client error:', error.message);
      console.error(error.stack);
    },
  });

  // Try to connect
  console.log('Attempting to connect...');
  console.log('Client.WebSocketImpl:', client.WebSocketImpl);
  try {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
    ]);
    console.log('✓ Connected successfully!');
    // Success - give it a moment to stabilize
    await new Promise(resolve => setTimeout(resolve, 200));
  } catch (error) {
    console.error('✗ Failed to connect:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    if (client.connected || client.ws) {
      client.disconnect();
    }
    server.stop();
    // Give them time to close
    await new Promise(resolve => setTimeout(resolve, 100));
    process.exit(0);
  }
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
