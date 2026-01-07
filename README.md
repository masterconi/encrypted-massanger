# under heavy development be carfull when using!!!

# 🔐 Ultra-Secure Messenger

A production-ready, end-to-end encrypted messaging platform designed for maximum security, reliability, and performance.

## 🎯 Core Features

- **End-to-End Encryption**: Zero-knowledge architecture, servers never access plaintext
- **Forward Secrecy**: Double Ratchet protocol with per-message keys
- **Post-Compromise Security**: Automatic key rotation and secure recovery
- **High Performance**: Sub-100ms message delivery target
- **Extreme Reliability**: Guaranteed delivery, offline queueing, crash-safe design
- **Formal Security**: Explicit threat model and cryptographic correctness

## 🏗️ Architecture

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for complete system design.

## 🔑 Security

See [SECURITY.md](./docs/SECURITY.md) for threat model and security guarantees.

## 📡 Protocol

See [PROTOCOL.md](./docs/PROTOCOL.md) for complete protocol specification.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0

### Installation

```bash
npm install
npm run build
```

### Running the Server

```bash
npm run server
```

The server will start on `ws://localhost:8080`

### Using the GUI Client

1. **Start the GUI server:**
   ```bash
   npm run client
   ```

2. **Open your browser:**
   Navigate to `http://localhost:8000`

3. **Connect:**
   - Enter server URL: `ws://localhost:8080`
   - Click "Connect"
   - Generate or use your identity key
   - Add recipients and start messaging!

### Using the Client SDK (Programmatic)

```typescript
import { SecureMessengerClient, generateIdentityKeyPair } from './src/index.js';

const client = new SecureMessengerClient({
  serverUrl: 'ws://localhost:8080',
  identityKey: generateIdentityKeyPair(),
});

await client.connect();
await client.sendMessage(recipientId, 'Hello, secure world!');
```

## 🧪 Testing

```bash
npm test
npm run test:coverage
```

## 📚 Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Security Model](./docs/SECURITY.md)
- [Protocol Specification](./docs/PROTOCOL.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [API Reference](./docs/API.md)

## ⚠️ Security Notice

This software is provided for security research and development. Before production use:

1. Conduct a professional security audit
2. Review all cryptographic implementations
3. Test under adversarial conditions
4. Verify key management and storage

## 📄 License

Apache License Version 2.0 - See LICENSE file for details.

