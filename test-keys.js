// Simple test to verify key generation works correctly
import { SecureMessengerClient, generateIdentityKeyPair } from './dist/client/browser.js';

console.log('Testing key generation and storage...\n');

// Test 1: Generate keys
console.log('Test 1: Generating identity key pair');
const keyPair = generateIdentityKeyPair();
console.log('✓ Generated');
console.log('  Public key size:', keyPair.publicKey.length, '(expected: 32)');
console.log('  Private key size:', keyPair.privateKey.length, '(expected: 64)');

if (keyPair.publicKey.length !== 32) {
  console.error('✗ FAILED: Public key size is wrong!');
  process.exit(1);
}
if (keyPair.privateKey.length !== 64) {
  console.error('✗ FAILED: Private key size is wrong!');
  process.exit(1);
}
console.log('✓ Key sizes are correct\n');

// Test 2: Serialize/deserialize like localStorage
console.log('Test 2: Simulating localStorage serialization');
const serialized = {
  publicKey: Array.from(keyPair.publicKey),
  privateKey: Array.from(keyPair.privateKey),
};
console.log('✓ Serialized');
console.log('  Public key serialized size:', serialized.publicKey.length);
console.log('  Private key serialized size:', serialized.privateKey.length);

const deserialized = {
  publicKey: new Uint8Array(serialized.publicKey),
  privateKey: new Uint8Array(serialized.privateKey),
};
console.log('✓ Deserialized');
console.log('  Public key deserialized size:', deserialized.publicKey.length);
console.log('  Private key deserialized size:', deserialized.privateKey.length);

if (deserialized.publicKey.length !== 32) {
  console.error('✗ FAILED: Deserialized public key size is wrong!');
  process.exit(1);
}
if (deserialized.privateKey.length !== 64) {
  console.error('✗ FAILED: Deserialized private key size is wrong!');
  process.exit(1);
}
console.log('✓ Deserialization preserves correct sizes\n');

// Test 3: Create client with deserialized key
console.log('Test 3: Creating client with deserialized key');
try {
  const client = new SecureMessengerClient({
    serverUrl: 'ws://localhost:8080',
    identityKey: deserialized,
  });
  console.log('✓ Client created successfully');
  console.log('  Client identity key public size:', client.identityKey.publicKey.length);
  console.log('  Client identity key private size:', client.identityKey.privateKey.length);
} catch (error) {
  console.error('✗ FAILED to create client:', error.message);
  process.exit(1);
}

console.log('\n✓ All tests passed!');
