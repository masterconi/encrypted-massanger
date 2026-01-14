// Check ws module export structure
const ws1 = await import('ws');
console.log('ws module:', Object.keys(ws1));
console.log('ws.default:', typeof ws1.default);
console.log('ws.WebSocket:', typeof ws1.WebSocket);

// Named import
import { WebSocket } from 'ws';
console.log('\nNamed import WebSocket:', typeof WebSocket);
