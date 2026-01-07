# Protocol Specification

## Overview

The Ultra-Secure Messenger protocol is a custom secure messaging protocol inspired by the Signal Protocol and Noise Framework. It provides end-to-end encryption, forward secrecy, and mutual authentication.

## Protocol Version

Current version: **1**

## Message Format

All messages are binary-encoded for efficiency. The protocol uses a simple length-prefixed format:

```
[Message Type][Length][Payload]
```

### Message Types

- `0x01`: HandshakeInit
- `0x02`: HandshakeResponse
- `0x03`: HandshakeComplete
- `0x04`: EncryptedMessage
- `0x05`: DeliveryAck

## Handshake Protocol

### Phase 1: HandshakeInit

**Direction**: Client → Server

**Purpose**: Initiate handshake and authenticate client identity

**Format**:
```
+------------------+
| Ephemeral Key    | 32 bytes (X25519 public key)
+------------------+
| Identity Key     | 32 bytes (Ed25519 public key)
+------------------+
| Signature        | 64 bytes (Ed25519 signature)
+------------------+
| Timestamp        | 8 bytes (big-endian uint64)
+------------------+
| Nonce            | 16 bytes (random)
+------------------+
```

**Signature Data**: `ephemeral_key || identity_key || timestamp || nonce`

**Validation**:
- Verify signature with identity public key
- Check timestamp is within acceptable range (±5 minutes)
- Verify nonce is unique (optional, for replay prevention)

### Phase 2: HandshakeResponse

**Direction**: Server → Client

**Purpose**: Respond to handshake and establish shared secret

**Format**:
```
+------------------+
| Ephemeral Key    | 32 bytes (X25519 public key)
+------------------+
| Encrypted Prekey | 32 bytes (encrypted)
+------------------+
| MAC Tag          | 16 bytes (AES-GCM tag)
+------------------+
| IV               | 12 bytes (AES-GCM IV)
+------------------+
| Timestamp        | 8 bytes (big-endian uint64)
+------------------+
| Nonce            | 16 bytes (random)
+------------------+
```

**Key Derivation**:
1. Compute shared secret: `SS1 = X25519(client_ephemeral_priv, server_ephemeral_pub)`
2. Compute shared secret: `SS2 = X25519(client_identity_priv, server_ephemeral_pub)`
3. Derive root key: `root_key = HKDF(SS1 || SS2, salt=null, info="SecureMessenger-RootKey", length=32)`
4. Encrypt prekey: `encrypted_prekey = AES-256-GCM(prekey, root_key, iv, aad="handshake-prekey")`

### Phase 3: HandshakeComplete

**Direction**: Client → Server

**Purpose**: Confirm handshake completion

**Format**:
```
+------------------+
| Confirmation     | 32 bytes (HMAC-SHA-256)
+------------------+
```

**Confirmation**: `HMAC-SHA-256(ephemeral_keys || prekey, root_key)`

## Encrypted Message Protocol

### Message Structure

**Format**:
```
+------------------+
| Message ID       | 16 bytes (random)
+------------------+
| Header Length    | 4 bytes (big-endian uint32)
+------------------+
| Encrypted Header | variable (encrypted)
+------------------+
| Ciphertext Length| 4 bytes (big-endian uint32)
+------------------+
| Ciphertext       | variable (encrypted)
+------------------+
| MAC Length       | 4 bytes (big-endian uint32)
+------------------+
| MAC              | 16 bytes (HMAC-SHA-256)
+------------------+
| Timestamp        | 8 bytes (big-endian uint64)
+------------------+
| Version          | 4 bytes (big-endian uint32)
+------------------+
```

### Header Structure (Encrypted)

**Plaintext Format**:
```
+------------------+
| DH Public Key    | 32 bytes (X25519)
+------------------+
| Message Number   | 4 bytes (big-endian uint32)
+------------------+
| Previous Chain   | 4 bytes (big-endian uint32)
+------------------+
```

**Encryption**: Header encrypted with message key (from Double Ratchet)

### Message Encryption Process

1. **Ratchet Forward**: Derive message key from chain key
2. **Encrypt Header**: Encrypt header with message key
3. **Encrypt Body**: Encrypt message body with message key
4. **Compute MAC**: `MAC = HMAC-SHA-256(header || ciphertext || tag, mac_key)`

### Message Decryption Process

1. **Verify MAC**: Verify message authentication
2. **Decrypt Header**: Decrypt header to get ratchet info
3. **Ratchet Forward**: Derive message key based on header
4. **Decrypt Body**: Decrypt message body
5. **Send Ack**: Acknowledge successful decryption

## Double Ratchet Protocol

### State Structure

```typescript
interface RatchetState {
  rootKey: Uint8Array;              // 32 bytes
  sendingChainKey?: ChainKey;        // 32 bytes + index
  receivingChainKey?: ChainKey;      // 32 bytes + index
  sendingEphemeralKey?: KeyPair;    // X25519 key pair
  receivingEphemeralPublicKey?: PublicKey; // 32 bytes
  skippedMessageKeys: Map<number, MessageKey>; // For out-of-order
  previousChainLength: number;
}
```

### Key Derivation

1. **Root Key**: `HKDF(shared_secret, salt=null, info="SecureMessenger-RootKey", length=32)`
2. **Chain Key**: `HKDF(root_key, salt=null, info="SecureMessenger-ChainKey", length=32)`
3. **Message Key**: `HKDF(chain_key, salt=null, info="SecureMessenger-MessageKey", length=64)`
   - First 32 bytes: encryption key
   - Next 32 bytes: MAC key
   - Remaining 32 bytes: next chain key

### Ratchet Operations

#### Sending (Ratchet Encrypt)

1. If no sending chain: create new chain from root key
2. Derive message key from chain key
3. Update chain key to next key
4. Encrypt message with message key
5. Include DH public key in header

#### Receiving (Ratchet Decrypt)

1. Check if new DH key (new chain)
2. If new chain: compute new root key and chain key
3. Handle out-of-order messages (skip forward)
4. Derive message key from chain key
5. Update chain key to next key
6. Decrypt message

## Delivery Acknowledgment

### Ack Format

```
+------------------+
| Message ID       | 16 bytes
+------------------+
| Received At      | 8 bytes (big-endian uint64)
+------------------+
| Success          | 1 byte (0x00 = false, 0x01 = true)
+------------------+
```

### Ack Behavior

- **Success = true**: Message decrypted successfully
- **Success = false**: Message decryption failed (corrupted, wrong key, etc.)
- **Timeout**: If no ack received within 5 seconds, retry

## Error Handling

### Error Codes

- `0x00`: Success
- `0x01`: Invalid message format
- `0x02`: Authentication failed
- `0x03`: Decryption failed
- `0x04`: Rate limit exceeded
- `0x05`: Message too large
- `0x06`: Handshake failed
- `0x07`: Invalid protocol version
- `0x08`: Clock skew too large

### Error Response Format

```
+------------------+
| Error Code       | 1 byte
+------------------+
| Error Message    | variable (UTF-8, optional)
+------------------+
```

## Protocol State Machine

### Client States

1. **DISCONNECTED**: Not connected to server
2. **CONNECTING**: Establishing WebSocket connection
3. **HANDSHAKING**: Performing cryptographic handshake
4. **CONNECTED**: Ready to send/receive messages
5. **ERROR**: Error state, must reconnect

### Server States

1. **LISTENING**: Waiting for connections
2. **HANDSHAKING**: Performing handshake with client
3. **CONNECTED**: Client authenticated, ready for messages
4. **ERROR**: Error state, close connection

## Security Properties

### Authentication

- **Mutual Authentication**: Both client and server authenticated
- **Identity Binding**: Identity keys bound to ephemeral keys via signature
- **Replay Protection**: Timestamps and nonces prevent replay

### Confidentiality

- **End-to-End Encryption**: Messages encrypted, server cannot decrypt
- **Forward Secrecy**: Past messages secure after key compromise
- **Key Isolation**: Each message uses unique key

### Integrity

- **Message Authentication**: MACs prevent tampering
- **Header Authentication**: Headers authenticated
- **Replay Detection**: Sequence numbers prevent replay

## Protocol Limitations

1. **Header Encryption**: Header encryption key management needs refinement
2. **Out-of-Order Messages**: Limited to 1000 skipped messages
3. **Chain Length**: Maximum 2^32 messages per chain
4. **Clock Skew**: Tolerant of ±5 minutes

## Future Enhancements

1. **Group Messaging**: Extend protocol for groups
2. **File Transfer**: Add file transfer protocol
3. **Message Deletion**: Add message deletion protocol
4. **Key Rotation**: Explicit key rotation messages
5. **Multi-Device**: Device synchronization protocol

