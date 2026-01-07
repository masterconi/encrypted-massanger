# Ultra-Secure Messenger GUI Client

A modern, beautiful web-based GUI client for the Ultra-Secure Messenger.

## Features

- 🔐 **Secure Connection**: Connect to secure messenger server
- 💬 **Real-time Messaging**: Send and receive encrypted messages
- 👥 **Recipient Management**: Add and manage multiple recipients
- 🔑 **Identity Management**: Generate and manage your identity keys
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Beautiful, dark-themed interface

## Quick Start

### 1. Start the GUI Server

```bash
cd client
npm start
```

The GUI will be available at `http://localhost:3000`

### 2. Start the Messenger Server

In the main project directory:

```bash
npm run server
```

The server will run on `ws://localhost:8080`

### 3. Open in Browser

Navigate to `http://localhost:3000` in your web browser.

## Usage

### Connecting

1. Enter the server URL (default: `ws://localhost:8080`)
2. Click "Connect"
3. Wait for connection status to show "Connected"

### Managing Identity

- Your identity key is automatically generated on first use
- Click "Copy" to copy your public key to share with others
- Click "Generate New Key" to create a new identity

### Adding Recipients

1. Paste the recipient's public key (64 hex characters)
2. Optionally enter a name for the recipient
3. Click "Add Recipient"

### Sending Messages

1. Select a recipient from the recipients list
2. Type your message in the input area
3. Click "Send" or press Enter

## Architecture

The GUI client consists of:

- **HTML** (`index.html`): Structure and layout
- **CSS** (`styles.css`): Modern, responsive styling
- **JavaScript** (`app.js`): Client logic and UI management
- **Server** (`server.js`): Simple HTTP server to serve the files

## Future Enhancements

- Full integration with SecureMessengerClient library
- Message encryption/decryption in browser
- Message history persistence
- File sharing
- Group messaging
- Voice/video calls

## Notes

Currently, the GUI uses a simplified WebSocket connection for demonstration. For full security, integrate with the `SecureMessengerClient` library using:

- Electron (for desktop app)
- Browser bundler (Webpack/Vite) to bundle the client library
- Node.js bridge server

