// Test handshake initialization
import { generateIdentityKeyPair, generateEphemeralKeyPair } from './dist/crypto/keygen.js';
import { createHandshakeInit } from './dist/protocol/handshake.js';

console.log('Testing handshake creation...\n');

// Generate keys
console.log('Generating keys...');
const identityKey = generateIdentityKeyPair();
const ephemeralKey = generateEphemeralKeyPair();

console.log('✓ Generated keys');
console.log('  Identity public key size:', identityKey.publicKey.length);
console.log('  Identity private key size:', identityKey.privateKey.length);
console.log('  Ephemeral public key size:', ephemeralKey.publicKey.length);
console.log('  Ephemeral private key size:', ephemeralKey.privateKey.length);

// Simulate localStorage serialization/deserialization
console.log('\nSimulating localStorage...');
const serialized = {
  publicKey: Array.from(identityKey.publicKey),
  privateKey: Array.from(identityKey.privateKey),
};
const deserialized = {
  publicKey: new Uint8Array(serialized.publicKey),
  privateKey: new Uint8Array(serialized.privateKey),
};

console.log('✓ Serialized and deserialized');
console.log('  Deserialized public key size:', deserialized.publicKey.length);
console.log('  Deserialized private key size:', deserialized.privateKey.length);

// Try to create handshake init
console.log('\nCreating handshake init...');
try {
  const { message, state } = createHandshakeInit(deserialized, ephemeralKey);
  console.log('✓ Handshake init created successfully');
  console.log('  Message size:', message.length);
  console.log('  State has identity key:', !!state.identityKey);
} catch (error) {
  console.error('✗ FAILED to create handshake init:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

console.log('\n✓ All handshake tests passed!');
