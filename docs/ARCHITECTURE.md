# System Architecture

## Overview

The Ultra-Secure Messenger is designed as a zero-knowledge, end-to-end encrypted messaging platform. The architecture prioritizes security, reliability, and performance while maintaining a clean separation of concerns.

## Core Principles

1. **Zero-Knowledge Architecture**: Servers never have access to plaintext messages
2. **Forward Secrecy**: Past messages remain secure even if keys are compromised
3. **Post-Compromise Security**: System recovers security after key compromise
4. **Stateless Server Design**: Servers are horizontally scalable
5. **Defense in Depth**: Multiple layers of security controls

## System Components

### 1. Cryptographic Core (`src/crypto/`)

The cryptographic core provides all low-level cryptographic operations:

- **Key Generation** (`keygen.ts`): Ed25519 identity keys, X25519 ephemeral keys
- **Key Derivation** (`hkdf.ts`): HKDF-SHA-256 for secure key derivation
- **Encryption** (`encryption.ts`): AES-256-GCM authenticated encryption
- **Double Ratchet** (`ratchet.ts`): Forward secrecy protocol implementation

**Security Properties:**
- Constant-time operations where possible
- Secure memory handling (best-effort zeroing)
- No custom cryptography
- Audited cryptographic primitives only

### 2. Protocol Layer (`src/protocol/`)

The protocol layer implements the secure messaging protocol:

- **Handshake** (`handshake.ts`): Mutual authentication and key establishment
- **Message Format** (`message.ts`): Encrypted message structure and handling

**Protocol Features:**
- Three-way handshake with mutual authentication
- Message encryption with Double Ratchet
- Anti-replay protections
- Message ordering and deduplication

### 3. Client Library (`src/client/`)

The client provides a high-level API for applications:

- **Connection Management**: WebSocket connection with automatic reconnection
- **Message Queue**: Offline message queueing with retry logic
- **State Management**: Ratchet state per conversation
- **Delivery Guarantees**: Acknowledgment-based delivery

**Client Features:**
- Automatic retry with exponential backoff
- Offline message queueing
- Delivery acknowledgments
- Graceful degradation

### 4. Server (`src/server/`)

The server provides encrypted message relay:

- **Message Relay**: Encrypted message forwarding
- **Rate Limiting**: Abuse prevention
- **Message Storage**: Temporary encrypted storage (server cannot decrypt)
- **Scalability**: Stateless design for horizontal scaling

**Server Features:**
- Stateless message relay
- Rate limiting per client
- Message expiration
- Automatic cleanup

## Data Flow

### Message Sending Flow

```
Client A                          Server                          Client B
   |                                |                                |
   |--[Handshake Init]------------->|                                |
   |<-[Handshake Response]----------|                                |
   |--[Handshake Complete]--------->|                                |
   |                                |                                |
   |--[Encrypted Message]---------->|                                |
   |                                |--[Encrypted Message]---------->|
   |                                |<-[Delivery Ack]----------------|
   |<-[Delivery Ack]----------------|                                |
```

### Handshake Flow

1. **Client → Server**: HandshakeInit
   - Client ephemeral public key (X25519)
   - Client identity public key (Ed25519)
   - Signature over handshake data
   - Timestamp and nonce

2. **Server → Client**: HandshakeResponse
   - Server ephemeral public key (X25519)
   - Encrypted prekey material
   - MAC and timestamp

3. **Client → Server**: HandshakeComplete
   - Confirmation MAC

### Message Encryption Flow

1. **Ratchet Forward**: Derive new message key from chain key
2. **Encrypt Header**: Encrypt ratchet metadata
3. **Encrypt Body**: Encrypt message plaintext
4. **Compute MAC**: Authenticate entire message
5. **Send**: Transmit encrypted message

### Message Decryption Flow

1. **Receive**: Get encrypted message
2. **Verify MAC**: Authenticate message
3. **Decrypt Header**: Extract ratchet information
4. **Ratchet Forward**: Derive message key
5. **Decrypt Body**: Decrypt message plaintext
6. **Send Ack**: Acknowledge delivery

## Security Architecture

### Threat Model

See [SECURITY.md](./SECURITY.md) for detailed threat model.

### Defense Layers

1. **Cryptographic Security**
   - Strong encryption (AES-256-GCM)
   - Forward secrecy (Double Ratchet)
   - Strong authentication (Ed25519)

2. **Protocol Security**
   - Anti-replay (timestamps, nonces)
   - Message authentication (MACs)
   - Key rotation (automatic)

3. **System Security**
   - Rate limiting
   - Input validation
   - Secure defaults

4. **Operational Security**
   - No plaintext logging
   - Secure key storage
   - Minimal attack surface

## Performance Considerations

### Optimization Strategies

1. **Asynchronous Operations**: All I/O is non-blocking
2. **Batch Operations**: Group cryptographic operations when safe
3. **Connection Pooling**: Reuse WebSocket connections
4. **Efficient Serialization**: Binary message format
5. **Minimal Round-trips**: Optimized handshake and message flow

### Performance Targets

- **Message Delivery**: < 100ms (local network)
- **Handshake**: < 500ms
- **Encryption Overhead**: < 10ms per message
- **Memory Usage**: < 50MB per active connection

## Scalability

### Horizontal Scaling

The server is designed for horizontal scaling:

- **Stateless Design**: No shared state between servers
- **Message Routing**: Can use load balancer
- **Database Optional**: Can use external message store

### Vertical Scaling

- **Connection Limits**: Configurable per server
- **Memory Management**: Efficient buffer management
- **CPU Usage**: Optimized cryptographic operations

## Reliability

### Guaranteed Delivery

- **Acknowledgment-Based**: Messages acknowledged before removal
- **Retry Logic**: Exponential backoff on failure
- **Offline Queue**: Messages queued when offline
- **Message Expiration**: Prevents infinite retries

### Fault Tolerance

- **Network Partitions**: Graceful degradation
- **Server Failures**: Automatic reconnection
- **Clock Skew**: Tolerant of reasonable skew
- **Message Loss**: Detection and retry

## Deployment Architecture

### Recommended Deployment

```
                    [Load Balancer]
                           |
        +------------------+------------------+
        |                  |                  |
   [Server 1]         [Server 2]         [Server N]
        |                  |                  |
        +------------------+------------------+
                           |
                    [Message Store]
                    (Optional)
```

### High Availability

- Multiple server instances
- Load balancing
- Health checks
- Graceful shutdown

## Monitoring and Observability

### Metrics (No Sensitive Data)

- Connection count
- Message throughput
- Error rates
- Latency percentiles

### Logging

- Structured logging
- No sensitive data
- Error tracking
- Performance metrics

## Future Enhancements

1. **Multi-Device Support**: Synchronize keys across devices
2. **Group Messaging**: Secure group conversations
3. **File Transfer**: Encrypted file sharing
4. **Voice/Video**: Encrypted media calls
5. **Message Search**: Client-side encrypted search

