// Check Node.js native WebSocket API
console.log('WebSocket methods:', Object.getOwnPropertyNames(WebSocket.prototype).filter(m => !m.startsWith('_')));

const ws = new WebSocket('ws://localhost:9999');
console.log('\nWebSocket instance methods:');
console.log('has .on:', typeof ws.on);
console.log('has .addEventListener:', typeof ws.addEventListener);
console.log('has .readyState:', typeof ws.readyState);

ws.close();
