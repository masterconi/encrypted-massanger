/**
 * Basic Usage Example
 * 
 * Demonstrates how to use the Ultra-Secure Messenger client and server.
 */

import { SecureMessengerClient, generateIdentityKeyPair } from '../src/index';

async function example() {
  // Generate identity keys for client
  const aliceIdentity = generateIdentityKeyPair();
  const bobIdentity = generateIdentityKeyPair();

  // Create client for Alice
  const alice = new SecureMessengerClient({
    serverUrl: 'ws://localhost:8080',
    identityKey: aliceIdentity,
    onMessage: (senderId, message) => {
      console.log(`Alice received from ${senderId}:`, new TextDecoder().decode(message));
    },
    onError: (error) => {
      console.error('Alice error:', error);
    },
    onConnected: () => {
      console.log('Alice connected');
    },
  });

  // Create client for Bob
  const bob = new SecureMessengerClient({
    serverUrl: 'ws://localhost:8080',
    identityKey: bobIdentity,
    onMessage: (senderId, message) => {
      console.log(`Bob received from ${senderId}:`, new TextDecoder().decode(message));
    },
    onError: (error) => {
      console.error('Bob error:', error);
    },
    onConnected: () => {
      console.log('Bob connected');
    },
  });

  // Connect both clients
  console.log('Connecting clients...');
  await Promise.all([alice.connect(), bob.connect()]);

  // Send message from Alice to Bob
  // Note: In production, you'd need Bob's public key/ID
  const bobId = Buffer.from(bobIdentity.publicKey).toString('hex');
  console.log('Sending message from Alice to Bob...');
  await alice.sendMessage(bobId, 'Hello, Bob! This is a secure message.');

  // Wait a bit for message delivery
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Cleanup
  alice.disconnect();
  bob.disconnect();
  console.log('Example complete');
}

// Run example if this file is executed directly
if (require.main === module) {
  example().catch(console.error);
}

export { example };

