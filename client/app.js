/**
 * Ultra-Secure Messenger GUI Client
 * Uses the bundled SecureMessengerClient library
 */

class MessengerGUI {
    constructor() {
        this.client = null;
        this.currentRecipient = null;
        this.recipients = new Map();
        this.identityKey = null;
        this.isConnected = false;
        
        this.initializeElements();
        this.attachEventListeners();
        this.setupMobileMenu();
        this.loadIdentity();
    }
    
    /**
     * Helper: Convert array-like data to proper Uint8Array
     */
    toUint8Array(data) {
        if (data instanceof Uint8Array) {
            return data;
        }
        if (Array.isArray(data)) {
            const arr = new Uint8Array(data);
            console.log('[DEBUG] toUint8Array from Array:', {
                inputLength: data.length,
                outputLength: arr.length,
                outputType: arr.constructor.name,
                match: arr.length === data.length
            });
            return arr;
        }
        if (data && typeof data === 'object' && data.length !== undefined) {
            // Handle array-like objects
            const arr = new Uint8Array(Array.from(data));
            console.log('[DEBUG] toUint8Array from array-like:', {
                inputLength: data.length,
                outputLength: arr.length,
                outputType: arr.constructor.name,
                match: arr.length === data.length
            });
            return arr;
        }
        throw new Error(`Cannot convert ${typeof data} to Uint8Array`);
    }
    
    /**
     * Helper: Convert Uint8Array to hex string for display
     */
    toHexString(data) {
        return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    initializeElements() {
        this.serverUrlInput = document.getElementById('serverUrl');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');

        this.publicKeyDisplay = document.getElementById('publicKey');
        this.copyPublicKeyBtn = document.getElementById('copyPublicKeyBtn');
        this.generateKeyBtn = document.getElementById('generateKeyBtn');

        this.recipientKeyInput = document.getElementById('recipientKey');
        this.recipientNameInput = document.getElementById('recipientName');
        this.addRecipientBtn = document.getElementById('addRecipientBtn');
        this.recipientsList = document.getElementById('recipientsList');

        this.chatTitle = document.getElementById('chatTitle');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        
        this.sidebar = document.getElementById('sidebar');
        this.sidebarBackdrop = document.getElementById('sidebarBackdrop');
        this.mobileToggle = document.getElementById('mobileToggle');
    }

    setupMobileMenu() {
        this.mobileToggle.addEventListener('click', () => {
            this.toggleMobileSidebar();
        });
        
        this.sidebarBackdrop.addEventListener('click', () => {
            this.closeMobileSidebar();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMobileSidebar();
            }
        });
    }
    
    toggleMobileSidebar() {
        this.sidebar.classList.toggle('mobile-open');
        this.sidebarBackdrop.classList.toggle('active');
    }
    
    closeMobileSidebar() {
        this.sidebar.classList.remove('mobile-open');
        this.sidebarBackdrop.classList.remove('active');
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
                console.log('[DEBUG] Raw keyData from localStorage:', {
                    publicKeyLength: keyData.publicKey?.length,
                    privateKeyLength: keyData.privateKey?.length,
                    publicKeyType: typeof keyData.publicKey,
                    privateKeyType: typeof keyData.privateKey,
                });
                
                // Properly convert to Uint8Array using helper
                const publicKey = this.toUint8Array(keyData.publicKey);
                const privateKey = this.toUint8Array(keyData.privateKey);
                
                console.log('[DEBUG] After conversion:', {
                    publicKeySize: publicKey.length,
                    privateKeySize: privateKey.length,
                    publicKeyType: publicKey.constructor.name,
                    privateKeyType: privateKey.constructor.name,
                });
                
                this.identityKey = {
                    publicKey: publicKey,
                    privateKey: privateKey,
                };
                
                // Validate key sizes
                if (this.identityKey.publicKey.length !== 32) {
                    throw new Error(`Invalid public key size: ${this.identityKey.publicKey.length}, expected 32`);
                }
                if (this.identityKey.privateKey.length !== 64) {
                    throw new Error(`Invalid private key size: ${this.identityKey.privateKey.length}, expected 64`);
                }
                
                console.log('[DEBUG] Identity loaded successfully');
                this.updatePublicKeyDisplay();
            } catch (e) {
                console.error('Failed to load identity:', e);
                this.generateNewIdentity();
            }
        } else {
            this.generateNewIdentity();
        }

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
        console.log('[DEBUG] Generating new identity...');
        console.log('[DEBUG] SecureMessenger available:', typeof SecureMessenger);
        console.log('[DEBUG] SecureMessenger object:', SecureMessenger);
        
        try {
            if (typeof SecureMessenger === 'undefined') {
                console.error('[ERROR] SecureMessenger is undefined');
                this.showNotification('Client library not loaded', 'error');
                return;
            }
            
            console.log('[DEBUG] generateIdentityKeyPair:', SecureMessenger.generateIdentityKeyPair);
            this.identityKey = SecureMessenger.generateIdentityKeyPair();
            console.log('[DEBUG] Identity key generated:', {
                publicKey: this.identityKey.publicKey,
                publicKeySize: this.identityKey.publicKey.length,
                privateKey: this.identityKey.privateKey,
                privateKeySize: this.identityKey.privateKey.length
            });
            
            // Validate key sizes
            if (this.identityKey.publicKey.length !== 32) {
                throw new Error(`Invalid public key size: ${this.identityKey.publicKey.length}, expected 32`);
            }
            if (this.identityKey.privateKey.length !== 64) {
                throw new Error(`Invalid private key size: ${this.identityKey.privateKey.length}, expected 64`);
            }
            
            this.saveIdentity();
            this.updatePublicKeyDisplay();
            this.showNotification('New identity generated', 'success');
        } catch (error) {
            console.error('Failed to generate identity:', error);
            this.showNotification('Failed to generate identity: ' + error.message, 'error');
        }
    }

    saveIdentity() {
        if (this.identityKey) {
            const keyData = {
                publicKey: Array.from(this.identityKey.publicKey),
                privateKey: Array.from(this.identityKey.privateKey),
            };
            console.log('[DEBUG] Saving identity - lengths:', {
                publicKey: keyData.publicKey.length,
                privateKey: keyData.privateKey.length
            });
            console.log('[DEBUG] Full keyData being saved:', keyData);
            localStorage.setItem('messenger_identity', JSON.stringify(keyData));
            const loaded = localStorage.getItem('messenger_identity');
            console.log('[DEBUG] Verification - loaded from storage:', loaded.substring(0, 100) + '...');
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
        console.log('[DEBUG] Connect button clicked');
        const serverUrl = this.serverUrlInput.value.trim();
        console.log('[DEBUG] Server URL:', serverUrl);
        
        if (!serverUrl) {
            this.showNotification('Please enter a server URL', 'error');
            return;
        }

        if (!this.identityKey) {
            this.showNotification('Please generate an identity key first', 'error');
            return;
        }

        console.log('[DEBUG] SecureMessenger available:', typeof SecureMessenger);
        console.log('[DEBUG] SecureMessenger.SecureMessengerClient:', SecureMessenger?.SecureMessengerClient);
        
        if (typeof SecureMessenger === 'undefined') {
            console.error('[ERROR] SecureMessenger is undefined');
            this.showNotification('Client library not loaded', 'error');
            return;
        }

        this.updateConnectionStatus('connecting', 'Connecting...');
        this.connectBtn.disabled = true;

        try {
            console.log('[DEBUG] Creating client...');
            
            // Debug: Log identity key details before creating client
            console.log('[DEBUG] Identity key before client creation:', {
                publicKeyType: this.identityKey.publicKey.constructor.name,
                publicKeySize: this.identityKey.publicKey.length,
                publicKeyBytes: Array.from(this.identityKey.publicKey.slice(0, 8)),
                privateKeyType: this.identityKey.privateKey.constructor.name,
                privateKeySize: this.identityKey.privateKey.length,
                privateKeyBytes: Array.from(this.identityKey.privateKey.slice(0, 8)),
            });
            
            // Validate before using
            if (this.identityKey.publicKey.length !== 32) {
                throw new Error(`Invalid public key size before client creation: ${this.identityKey.publicKey.length}`);
            }
            if (this.identityKey.privateKey.length !== 64) {
                throw new Error(`Invalid private key size before client creation: ${this.identityKey.privateKey.length}`);
            }
            
            this.client = new SecureMessenger.SecureMessengerClient({
                serverUrl: serverUrl,
                identityKey: this.identityKey,
                WebSocketImpl: SecureMessenger.BrowserWebSocket,
                onMessage: (senderId, message) => {
                    const text = new TextDecoder().decode(message);
                    this.addMessage(senderId, text, 'received', new Date());
                },
                onError: (error) => {
                    console.error('Client error:', error);
                    this.showNotification(error.message, 'error');
                },
                onConnected: () => {
                    console.log('[DEBUG] Connected to server');
                    this.isConnected = true;
                    this.updateConnectionStatus('connected', 'Connected');
                    this.connectBtn.disabled = true;
                    this.disconnectBtn.disabled = false;
                    this.messageInput.disabled = !this.currentRecipient;
                    this.sendBtn.disabled = !this.currentRecipient;
                    this.showNotification('Connected to server', 'success');
                },
                onDisconnected: () => {
                    console.log('[DEBUG] Disconnected from server');
                    this.isConnected = false;
                    this.updateConnectionStatus('disconnected', 'Disconnected');
                    this.connectBtn.disabled = false;
                    this.disconnectBtn.disabled = true;
                    this.messageInput.disabled = true;
                    this.sendBtn.disabled = true;
                }
            });

            console.log('[DEBUG] Client created, calling connect()...');
            console.log('[DEBUG] Client instance:', {
                connectedStatus: this.client.connected,
                hasIdentityKey: !!this.client.identityKey,
                identityKeyPublicKeySize: this.client.identityKey?.publicKey?.length,
                identityKeyPrivateKeySize: this.client.identityKey?.privateKey?.length,
            });
            await this.client.connect();
            console.log('[DEBUG] connect() completed');
        } catch (error) {
            console.error('Connection error:', error);
            this.showNotification('Failed to connect: ' + error.message, 'error');
            this.updateConnectionStatus('disconnected', 'Disconnected');
            this.connectBtn.disabled = false;
        }
    }

    disconnect() {
        if (this.client) {
            this.client.disconnect();
            this.client = null;
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
        if (!this.isConnected || !this.currentRecipient || !this.client) {
            return;
        }

        const text = this.messageInput.value.trim();
        if (!text) {
            return;
        }

        this.messageInput.value = '';

        this.addMessage(this.currentRecipient, text, 'sent', new Date());

        try {
            await this.client.sendMessage(this.currentRecipient, text);
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showNotification('Failed to send message', 'error');
        }
    }

    addMessage(senderId, text, type, timestamp) {
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
        this.messagesContainer.innerHTML = '<div class="empty-chat"><div class="empty-icon">💬</div><p>No messages yet</p></div>';
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
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Create a toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOM Content Loaded');
    console.log('[DEBUG] SecureMessenger:', typeof SecureMessenger, SecureMessenger);
    window.messengerGUI = new MessengerGUI();
});
