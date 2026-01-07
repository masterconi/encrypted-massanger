# Deployment Guide

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Linux/macOS/Windows server
- Firewall configured for WebSocket traffic
- SSL/TLS certificate (recommended for production)

## Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd massanger
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build Project

```bash
npm run build
```

## Configuration

### Environment Variables

Create a `.env` file:

```bash
# Server Configuration
PORT=8080
HOST=0.0.0.0

# Security
SERVER_IDENTITY_KEY_PATH=/path/to/server-identity.key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_MESSAGES=100

# Message Storage
MESSAGE_EXPIRY_MS=604800000  # 7 days
MAX_MESSAGE_SIZE=1048576     # 1 MB
```

### Server Identity Key

Generate server identity key:

```bash
node -e "
const { generateIdentityKeyPair } = require('./dist/crypto/keygen');
const fs = require('fs');
const key = generateIdentityKeyPair();
fs.writeFileSync('server-identity.key', JSON.stringify({
  publicKey: Array.from(key.publicKey),
  privateKey: Array.from(key.privateKey)
}));
"
```

**Security Note**: Store server identity key securely:
- Use OS keychain/secure storage
- Restrict file permissions: `chmod 600 server-identity.key`
- Never commit to version control

## Running the Server

### Development

```bash
npm run dev
```

### Production

```bash
npm run server
```

### Using PM2 (Recommended)

```bash
npm install -g pm2
pm2 start dist/server/index.js --name secure-messenger
pm2 save
pm2 startup
```

### Using systemd

Create `/etc/systemd/system/secure-messenger.service`:

```ini
[Unit]
Description=Ultra-Secure Messenger Server
After=network.target

[Service]
Type=simple
User=secure-messenger
WorkingDirectory=/opt/secure-messenger
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable secure-messenger
sudo systemctl start secure-messenger
```

## Reverse Proxy (Nginx)

### Nginx Configuration

```nginx
upstream secure_messenger {
    server 127.0.0.1:8080;
}

server {
    listen 443 ssl http2;
    server_name messenger.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://secure_messenger;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

## Security Hardening

### 1. Firewall Configuration

```bash
# Allow only WebSocket port
ufw allow 8080/tcp
# Or use iptables
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
```

### 2. User Isolation

```bash
# Create dedicated user
sudo useradd -r -s /bin/false secure-messenger
sudo chown -R secure-messenger:secure-messenger /opt/secure-messenger
```

### 3. Process Limits

Edit `/etc/security/limits.conf`:

```
secure-messenger soft nofile 65536
secure-messenger hard nofile 65536
```

### 4. SSL/TLS Configuration

- Use TLS 1.2 or higher
- Strong cipher suites only
- Perfect Forward Secrecy (PFS)
- HSTS headers

## Monitoring

### Health Checks

Create health check endpoint (optional):

```typescript
// Add to server
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
```

### Logging

Configure logging:

```bash
# Using PM2
pm2 logs secure-messenger

# Using systemd
journalctl -u secure-messenger -f
```

### Metrics

Monitor:
- Connection count
- Message throughput
- Error rates
- Memory usage
- CPU usage

## Scaling

### Horizontal Scaling

1. **Load Balancer**: Use load balancer (nginx, HAProxy)
2. **Stateless Design**: Server is stateless, can scale horizontally
3. **Session Affinity**: Optional (not required due to stateless design)
4. **Message Store**: Use external message store (Redis, database) if needed

### Vertical Scaling

1. **Connection Limits**: Adjust per server
2. **Memory**: Increase available memory
3. **CPU**: Use more CPU cores (Node.js uses single core, use cluster mode)

### Cluster Mode

```typescript
import cluster from 'cluster';
import os from 'os';

if (cluster.isMaster) {
  const numWorkers = os.cpus().length;
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker) => {
    cluster.fork();
  });
} else {
  // Start server
  server.start();
}
```

## Backup and Recovery

### Server Identity Key

**Critical**: Backup server identity key securely:

```bash
# Encrypt backup
gpg -c server-identity.key
# Store in secure location
```

### Message Store

If using persistent message store:
- Regular backups
- Encrypted backups
- Test restore procedures

## Upgrades

### Upgrade Procedure

1. **Backup**: Backup configuration and keys
2. **Test**: Test upgrade in staging
3. **Deploy**: Deploy new version
4. **Monitor**: Monitor for issues
5. **Rollback**: Have rollback plan ready

### Zero-Downtime Upgrades

1. **Blue-Green Deployment**: Run two instances, switch traffic
2. **Gradual Rollout**: Upgrade servers one at a time
3. **Health Checks**: Verify health before switching

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check firewall
   - Verify port is listening: `netstat -tlnp | grep 8080`
   - Check server logs

2. **High Memory Usage**
   - Check for memory leaks
   - Reduce connection limits
   - Increase server memory

3. **Rate Limiting Issues**
   - Adjust rate limit settings
   - Check for abuse
   - Review rate limiter configuration

4. **Handshake Failures**
   - Check server identity key
   - Verify client identity keys
   - Check clock synchronization

## Performance Tuning

### Node.js Options

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" node dist/server/index.js

# Enable V8 optimizations
NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size" node dist/server/index.js
```

### System Tuning

```bash
# Increase file descriptor limits
ulimit -n 65536

# TCP tuning
sysctl -w net.core.somaxconn=65535
sysctl -w net.ipv4.tcp_max_syn_backlog=65535
```

## Security Checklist

- [ ] Server identity key generated and secured
- [ ] Firewall configured
- [ ] SSL/TLS enabled
- [ ] User isolation configured
- [ ] Logging configured (no sensitive data)
- [ ] Rate limiting enabled
- [ ] Monitoring set up
- [ ] Backup procedures in place
- [ ] Security updates automated
- [ ] Access controls configured

## Production Readiness

Before going to production:

1. **Security Audit**: Professional security audit
2. **Load Testing**: Test under expected load
3. **Disaster Recovery**: Test backup/restore
4. **Monitoring**: Set up comprehensive monitoring
5. **Documentation**: Complete operational documentation
6. **Incident Response**: Incident response plan
7. **Compliance**: Verify compliance requirements

