# API Reference

## Client API

### SecureMessengerClient

Main client class for secure messaging.

#### Constructor

```typescript
new SecureMessengerClient(config: ClientConfig)
```

**Parameters:**
- `config.serverUrl` (string): WebSocket URL of the server
- `config.identityKey` (IdentityKeyPair, optional): Pre-generated identity key
- `config.onMessage` (function, optional): Callback for received messages
- `config.onError` (function, optional): Callback for errors
- `config.onConnected` (function, optional): Callback when connected
- `config.onDisconnected` (function, optional): Callback when disconnected

#### Methods

##### `connect(): Promise<void>`

Connect to the server and perform handshake.

**Returns:** Promise that resolves when connected

**Throws:** Error if connection fails

##### `sendMessage(recipientId: string, plaintext: string | Uint8Array): Promise<void>`

Send an encrypted message to a recipient.

**Parameters:**
- `recipientId` (string): Recipient's identity (hash of public key)
- `plaintext` (string | Uint8Array): Message to send

**Returns:** Promise that resolves when message is queued

##### `disconnect(): void`

Disconnect from the server and clean up resources.

##### `isConnected(): boolean`

Check if client is connected to server.

**Returns:** true if connected, false otherwise

## Cryptographic API

### Key Generation

#### `generateIdentityKeyPair(): IdentityKeyPair`

Generate a new Ed25519 identity key pair.

**Returns:** Identity key pair (public + private key)

#### `generateEphemeralKeyPair(): EphemeralKeyPair`

Generate a new X25519 ephemeral key pair.

**Returns:** Ephemeral key pair

#### `sign(privateKey: PrivateKey, message: Uint8Array): Uint8Array`

Sign a message with Ed25519.

**Parameters:**
- `privateKey`: Ed25519 private key (64 bytes)
- `message`: Message to sign

**Returns:** Signature (64 bytes)

#### `verify(publicKey: PublicKey, message: Uint8Array, signature: Uint8Array): boolean`

Verify an Ed25519 signature.

**Parameters:**
- `publicKey`: Ed25519 public key (32 bytes)
- `message`: Original message
- `signature`: Signature to verify

**Returns:** true if signature is valid, false otherwise

#### `computeSharedSecret(privateKey: PrivateKey, publicKey: PublicKey): SharedSecret`

Compute X25519 shared secret.

**Parameters:**
- `privateKey`: X25519 private key (32 bytes)
- `publicKey`: X25519 public key (32 bytes)

**Returns:** Shared secret (32 bytes)

### Encryption

#### `encrypt(plaintext: Uint8Array, key: Uint8Array, iv?: Uint8Array, additionalData?: Uint8Array): Promise<{ciphertext: Ciphertext, tag: MAC, iv: Nonce}>`

Encrypt plaintext with AES-256-GCM.

**Parameters:**
- `plaintext`: Data to encrypt
- `key`: Encryption key (32 bytes)
- `iv`: Initialization vector (optional, generated if not provided)
- `additionalData`: Additional authenticated data (optional)

**Returns:** Object containing ciphertext, authentication tag, and IV

#### `decrypt(ciphertext: Ciphertext, tag: MAC, key: Uint8Array, iv: Nonce, additionalData?: Uint8Array): Promise<Uint8Array>`

Decrypt ciphertext with AES-256-GCM.

**Parameters:**
- `ciphertext`: Encrypted data
- `tag`: Authentication tag (16 bytes)
- `key`: Decryption key (32 bytes)
- `iv`: Initialization vector (12 bytes)
- `additionalData`: Additional authenticated data (optional)

**Returns:** Decrypted plaintext

**Throws:** Error if decryption or authentication fails

### Key Derivation

#### `hkdf(inputKeyMaterial: Uint8Array, salt: Uint8Array | null, info: Uint8Array | string, length: number): Uint8Array`

Derive key using HKDF-SHA-256.

**Parameters:**
- `inputKeyMaterial`: Input key material
- `salt`: Optional salt (null for no salt)
- `info`: Context information (string or bytes)
- `length`: Desired output length in bytes

**Returns:** Derived key material

#### `deriveRootKey(sharedSecret: Uint8Array): Uint8Array`

Derive root key from shared secret.

**Parameters:**
- `sharedSecret`: Shared secret from key exchange

**Returns:** Root key (32 bytes)

#### `deriveChainKey(rootKey: Uint8Array, info?: string): Uint8Array`

Derive chain key from root key.

**Parameters:**
- `rootKey`: Root key
- `info`: Optional context information

**Returns:** Chain key (32 bytes)

#### `deriveMessageKey(chainKey: Uint8Array): {messageKey: Uint8Array, nextChainKey: Uint8Array}`

Derive message key and next chain key.

**Parameters:**
- `chainKey`: Current chain key

**Returns:** Object with message key (32 bytes) and next chain key (32 bytes)

### Double Ratchet

#### `createRatchetState(): RatchetState`

Create a new ratchet state.

**Returns:** Empty ratchet state

#### `initializeRatchet(state: RatchetState, rootKey: RootKey, sendingEphemeralKey?: EphemeralKeyPair, receivingEphemeralPublicKey?: PublicKey): void`

Initialize ratchet state from handshake.

**Parameters:**
- `state`: Ratchet state to initialize
- `rootKey`: Root key from handshake
- `sendingEphemeralKey`: Optional sending ephemeral key
- `receivingEphemeralPublicKey`: Optional receiving ephemeral public key

#### `ratchetEncrypt(state: RatchetState, plaintext: Uint8Array): {messageKey: MessageKey, header: Uint8Array, ciphertext: Uint8Array}`

Ratchet forward and get message key for encryption.

**Parameters:**
- `state`: Ratchet state
- `plaintext`: Message to encrypt (not encrypted here, just key derived)

**Returns:** Message key and ratchet information

#### `ratchetDecrypt(state: RatchetState, dhPublicKey: PublicKey, messageNumber: number, previousChainLength: number): MessageKey`

Ratchet forward and get message key for decryption.

**Parameters:**
- `state`: Ratchet state
- `dhPublicKey`: DH public key from message header
- `messageNumber`: Message number in chain
- `previousChainLength`: Length of previous chain

**Returns:** Message key for decryption

**Throws:** Error if message cannot be decrypted (old chain, etc.)

#### `cleanupRatchet(state: RatchetState): void`

Clean up ratchet state (zero sensitive data).

**Parameters:**
- `state`: Ratchet state to clean up

## Server API

### SecureMessengerServer

Main server class for message relay.

#### Constructor

```typescript
new SecureMessengerServer(config?: ServerConfig)
```

**Parameters:**
- `config.port` (number, optional): Server port (default: 8080)
- `config.host` (string, optional): Server host (default: '0.0.0.0')
- `config.serverIdentityKey` (IdentityKeyPair, optional): Server identity key
- `config.maxMessageSize` (number, optional): Maximum message size
- `config.messageExpiryMs` (number, optional): Message expiration time
- `config.rateLimitWindowMs` (number, optional): Rate limit window
- `config.rateLimitMaxMessages` (number, optional): Max messages per window

#### Methods

##### `start(): Promise<void>`

Start the server.

**Returns:** Promise that resolves when server is listening

**Throws:** Error if server fails to start

##### `stop(): Promise<void>`

Stop the server.

**Returns:** Promise that resolves when server is stopped

## Types

### IdentityKeyPair

```typescript
interface IdentityKeyPair {
  publicKey: Uint8Array;   // 32 bytes (Ed25519)
  privateKey: Uint8Array;  // 64 bytes (Ed25519)
}
```

### EphemeralKeyPair

```typescript
interface EphemeralKeyPair {
  publicKey: Uint8Array;   // 32 bytes (X25519)
  privateKey: Uint8Array;  // 32 bytes (X25519)
}
```

### RatchetState

```typescript
interface RatchetState {
  rootKey: RootKey;
  sendingChainKey?: ChainKey;
  receivingChainKey?: ChainKey;
  sendingEphemeralKey?: EphemeralKeyPair;
  receivingEphemeralPublicKey?: PublicKey;
  skippedMessageKeys: Map<number, MessageKey>;
  previousChainLength: number;
}
```

### MessageKey

```typescript
interface MessageKey {
  encryptionKey: Uint8Array;  // 32 bytes
  macKey: Uint8Array;          // 32 bytes
  iv: Uint8Array;              // 12 bytes
  index: number;               // Message number
}
```

## Constants

### CRYPTO_CONSTANTS

```typescript
const CRYPTO_CONSTANTS = {
  IDENTITY_KEY_SIZE: 32,
  IDENTITY_PRIVATE_KEY_SIZE: 64,
  EPHEMERAL_KEY_SIZE: 32,
  CHAIN_KEY_SIZE: 32,
  ROOT_KEY_SIZE: 32,
  MESSAGE_KEY_SIZE: 32,
  MAC_KEY_SIZE: 32,
  NONCE_SIZE: 16,
  AES_IV_SIZE: 12,
  AES_TAG_SIZE: 16,
  MAX_MESSAGE_SIZE: 1048576,  // 1 MB
  MAX_CHAIN_LENGTH: 4294967295,
  MAX_SKIPPED_MESSAGES: 1000,
  PROTOCOL_VERSION: 1,
  MESSAGE_ID_SIZE: 16,
  MESSAGE_EXPIRY_MS: 604800000,  // 7 days
  KEY_ROTATION_INTERVAL: 100,
  MAX_CLOCK_SKEW_MS: 300000,     // 5 minutes
};
```

## Error Handling

All functions throw errors with descriptive messages. Common errors:

- `Invalid key size`: Key has wrong length
- `Decryption failed`: Decryption or authentication failed
- `Message too large`: Message exceeds size limit
- `Handshake failed`: Handshake authentication failed
- `Rate limit exceeded`: Too many messages sent
- `Connection error`: Network or connection error

## Examples

### Basic Client Usage

```typescript
import { SecureMessengerClient, generateIdentityKeyPair } from './src';

const client = new SecureMessengerClient({
  serverUrl: 'ws://localhost:8080',
  identityKey: generateIdentityKeyPair(),
  onMessage: (senderId, message) => {
    console.log('Received:', new TextDecoder().decode(message));
  },
  onError: (error) => {
    console.error('Error:', error);
  },
});

await client.connect();
await client.sendMessage('recipient-id', 'Hello, world!');
```

### Server Usage

```typescript
import { SecureMessengerServer } from './src/server';

const server = new SecureMessengerServer({
  port: 8080,
  host: '0.0.0.0',
});

await server.start();
console.log('Server running on port 8080');
```

