// Test what the ws module exports
import ws from 'ws';

console.log('ws module default:', typeof ws);
console.log('ws constructor:', ws.constructor.name);

// Try to create a WebSocket
const wsInstance = new ws('ws://localhost:8080');
console.log('\nWebSocket instance methods:');
console.log('has .on:', typeof wsInstance.on);
console.log('has .addEventListener:', typeof wsInstance.addEventListener);
console.log('has .readyState:', typeof wsInstance.readyState);
console.log('has .close:', typeof wsInstance.close);

wsInstance.close();
