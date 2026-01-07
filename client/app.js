/**
 * Ultra-Secure Messenger GUI Client
 * 
 * This is a browser-based client. For Node.js integration,
 * we'll need to use a bridge or Electron.
 */

// Import the client library (this will work when bundled)
// For now, we'll create a browser-compatible version

class MessengerGUI {
    constructor() {
        this.client = null;
        this.currentRecipient = null;
        this.recipients = new Map(); // recipientId -> { name, publicKey }
        this.identityKey = null;
        this.isConnected = false;
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadIdentity();
    }

    initializeElements() {
        // Connection
        this.serverUrlInput = document.getElementById('serverUrl');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');

        // Identity
        this.publicKeyDisplay = document.getElementById('publicKey');
        this.copyPublicKeyBtn = document.getElementById('copyPublicKeyBtn');
        this.generateKeyBtn = document.getElementById('generateKeyBtn');

        // Recipients
        this.recipientKeyInput = document.getElementById('recipientKey');
        this.recipientNameInput = document.getElementById('recipientName');
        this.addRecipientBtn = document.getElementById('addRecipientBtn');
        this.recipientsList = document.getElementById('recipientsList');

        // Chat
        this.chatTitle = document.getElementById('chatTitle');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
    }

    attachEventListeners() {
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.generateKeyBtn.addEventListener('click', () => this.generateNewIdentity());
        this.copyPublicKeyBtn.addEventListener('click', () => this.copyPublicKey());
        this.addRecipientBtn.addEventListener('click', () => this.addRecipient());
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    loadIdentity() {
        const saved = localStorage.getItem('messenger_identity');
        if (saved) {
            try {
                const keyData = JSON.parse(saved);
                this.identityKey = {
                    publicKey: new Uint8Array(keyData.publicKey),
                    privateKey: new Uint8Array(keyData.privateKey),
                };
                this.updatePublicKeyDisplay();
            } catch (e) {
                console.error('Failed to load identity:', e);
                this.generateNewIdentity();
            }
        } else {
            this.generateNewIdentity();
        }

        // Load recipients
        const savedRecipients = localStorage.getItem('messenger_recipients');
        if (savedRecipients) {
            try {
                this.recipients = new Map(JSON.parse(savedRecipients));
                this.updateRecipientsList();
            } catch (e) {
                console.error('Failed to load recipients:', e);
            }
        }
    }

    async generateNewIdentity() {
        try {
            // In browser, we need to use Web Crypto API
            // For now, generate a placeholder - in production, use the actual crypto library
            const keyPair = await this.generateKeyPairBrowser();
            this.identityKey = keyPair;
            this.saveIdentity();
            this.updatePublicKeyDisplay();
            this.showNotification('New identity generated', 'success');
        } catch (error) {
            console.error('Failed to generate identity:', error);
            this.showNotification('Failed to generate identity', 'error');
        }
    }

    async generateKeyPairBrowser() {
        // Generate Ed25519 key pair using Web Crypto API
        // Note: This is a simplified version. In production, use the actual crypto library
        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'Ed25519',
            },
            true,
            ['sign', 'verify']
        ).catch(() => {
            // Fallback: generate random key pair structure
            const publicKey = new Uint8Array(32);
            const privateKey = new Uint8Array(64);
            crypto.getRandomValues(publicKey);
            crypto.getRandomValues(privateKey);
            return {
                publicKey: { buffer: publicKey },
                privateKey: { buffer: privateKey },
            };
        });

        // Convert to our format
        const publicKey = new Uint8Array(32);
        const privateKey = new Uint8Array(64);
        crypto.getRandomValues(publicKey);
        crypto.getRandomValues(privateKey);

        return {
            publicKey,
            privateKey,
        };
    }

    saveIdentity() {
        if (this.identityKey) {
            const keyData = {
                publicKey: Array.from(this.identityKey.publicKey),
                privateKey: Array.from(this.identityKey.privateKey),
            };
            localStorage.setItem('messenger_identity', JSON.stringify(keyData));
        }
    }

    updatePublicKeyDisplay() {
        if (this.identityKey) {
            const hex = Array.from(this.identityKey.publicKey)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            this.publicKeyDisplay.textContent = hex;
            this.copyPublicKeyBtn.disabled = false;
        } else {
            this.publicKeyDisplay.textContent = 'Not generated';
            this.copyPublicKeyBtn.disabled = true;
        }
    }

    copyPublicKey() {
        if (this.identityKey) {
            const hex = Array.from(this.identityKey.publicKey)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            navigator.clipboard.writeText(hex).then(() => {
                this.showNotification('Public key copied to clipboard', 'success');
            });
        }
    }

    addRecipient() {
        const keyHex = this.recipientKeyInput.value.trim();
        const name = this.recipientNameInput.value.trim() || `Recipient ${this.recipients.size + 1}`;

        if (!keyHex) {
            this.showNotification('Please enter a recipient public key', 'error');
            return;
        }

        try {
            // Validate hex key (should be 64 characters for 32 bytes)
            if (keyHex.length !== 64 || !/^[0-9a-fA-F]+$/.test(keyHex)) {
                throw new Error('Invalid key format');
            }

            const recipientId = keyHex;
            this.recipients.set(recipientId, { name, publicKey: keyHex });
            this.saveRecipients();
            this.updateRecipientsList();
            
            this.recipientKeyInput.value = '';
            this.recipientNameInput.value = '';
            this.showNotification('Recipient added', 'success');
        } catch (error) {
            this.showNotification('Invalid recipient key', 'error');
        }
    }

    saveRecipients() {
        localStorage.setItem('messenger_recipients', JSON.stringify(Array.from(this.recipients.entries())));
    }

    updateRecipientsList() {
        this.recipientsList.innerHTML = '';
        
        if (this.recipients.size === 0) {
            this.recipientsList.innerHTML = '<p class="empty-state">No recipients added</p>';
            return;
        }

        this.recipients.forEach((recipient, recipientId) => {
            const item = document.createElement('div');
            item.className = 'recipient-item';
            if (this.currentRecipient === recipientId) {
                item.classList.add('active');
            }
            
            item.innerHTML = `
                <div>
                    <div class="recipient-name">${this.escapeHtml(recipient.name)}</div>
                    <div class="recipient-key-short">${recipientId.substring(0, 16)}...</div>
                </div>
            `;
            
            item.addEventListener('click', () => this.selectRecipient(recipientId));
            this.recipientsList.appendChild(item);
        });
    }

    selectRecipient(recipientId) {
        this.currentRecipient = recipientId;
        this.updateRecipientsList();
        this.updateChatTitle();
        this.messageInput.disabled = !this.isConnected;
        this.sendBtn.disabled = !this.isConnected || !this.currentRecipient;
        this.loadMessages(recipientId);
    }

    updateChatTitle() {
        if (this.currentRecipient && this.recipients.has(this.currentRecipient)) {
            const recipient = this.recipients.get(this.currentRecipient);
            this.chatTitle.textContent = `Chat with ${recipient.name}`;
        } else {
            this.chatTitle.textContent = 'Select a recipient to start messaging';
        }
    }

    async connect() {
        const serverUrl = this.serverUrlInput.value.trim();
        if (!serverUrl) {
            this.showNotification('Please enter a server URL', 'error');
            return;
        }

        this.updateConnectionStatus('connecting', 'Connecting...');
        this.connectBtn.disabled = true;

        try {
            // In a real implementation, this would use the SecureMessengerClient
            // For now, we'll create a WebSocket connection directly
            // In production, you'd bundle the client library or use Electron
            
            this.ws = new WebSocket(serverUrl);
            
            this.ws.onopen = () => {
                this.isConnected = true;
                this.updateConnectionStatus('connected', 'Connected');
                this.connectBtn.disabled = true;
                this.disconnectBtn.disabled = false;
                this.messageInput.disabled = !this.currentRecipient;
                this.sendBtn.disabled = !this.currentRecipient;
                this.showNotification('Connected to server', 'success');
                // TODO: Perform cryptographic handshake
            };

            this.ws.onmessage = (event) => {
                // TODO: Handle encrypted messages
                this.handleIncomingMessage(event.data);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showNotification('Connection error', 'error');
                this.updateConnectionStatus('disconnected', 'Connection Error');
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus('disconnected', 'Disconnected');
                this.connectBtn.disabled = false;
                this.disconnectBtn.disabled = true;
                this.messageInput.disabled = true;
                this.sendBtn.disabled = true;
            };
        } catch (error) {
            console.error('Connection error:', error);
            this.showNotification('Failed to connect', 'error');
            this.updateConnectionStatus('disconnected', 'Disconnected');
            this.connectBtn.disabled = false;
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.updateConnectionStatus('disconnected', 'Disconnected');
        this.connectBtn.disabled = false;
        this.disconnectBtn.disabled = true;
        this.messageInput.disabled = true;
        this.sendBtn.disabled = true;
    }

    updateConnectionStatus(status, text) {
        this.statusIndicator.className = 'status-indicator ' + status;
        this.statusText.textContent = text;
    }

    async sendMessage() {
        if (!this.isConnected || !this.currentRecipient) {
            return;
        }

        const text = this.messageInput.value.trim();
        if (!text) {
            return;
        }

        // Clear input
        this.messageInput.value = '';

        // Display message immediately (optimistic UI)
        this.addMessage(this.currentRecipient, text, 'sent', new Date());

        try {
            // TODO: Encrypt and send message using SecureMessengerClient
            // For now, send as plaintext (NOT SECURE - for demo only)
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const message = {
                    type: 'message',
                    recipientId: this.currentRecipient,
                    text: text,
                };
                this.ws.send(JSON.stringify(message));
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showNotification('Failed to send message', 'error');
        }
    }

    handleIncomingMessage(data) {
        try {
            const message = JSON.parse(data);
            if (message.type === 'message' && message.senderId) {
                this.addMessage(message.senderId, message.text, 'received', new Date(message.timestamp || Date.now()));
            }
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }

    addMessage(senderId, text, type, timestamp) {
        // Clear empty state if present
        const emptyChat = this.messagesContainer.querySelector('.empty-chat');
        if (emptyChat) {
            emptyChat.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const senderName = type === 'sent' 
            ? 'You' 
            : (this.recipients.get(senderId)?.name || 'Unknown');
        
        messageDiv.innerHTML = `
            <div class="message-bubble">${this.escapeHtml(text)}</div>
            <div class="message-meta">
                <span class="message-time">${this.formatTime(timestamp)}</span>
            </div>
        `;

        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    loadMessages(recipientId) {
        // Clear messages
        this.messagesContainer.innerHTML = '<div class="empty-chat"><div class="empty-icon">💬</div><p>No messages yet</p></div>';
        // TODO: Load message history from storage
    }

    formatTime(date) {
        if (typeof date === 'number') {
            date = new Date(date);
        }
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Simple notification - could be enhanced with a toast library
        console.log(`[${type.toUpperCase()}] ${message}`);
        // You could add a toast notification UI here
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.messengerGUI = new MessengerGUI();
});

