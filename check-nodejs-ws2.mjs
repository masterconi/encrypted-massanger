// Check Node.js native WebSocket API
try {
  const ws = new WebSocket('ws://localhost:9999');
  console.log('has .on:', typeof ws.on);
  console.log('has .addEventListener:', typeof ws.addEventListener);
  console.log('readyState:', ws.readyState);
  
  // Kill the script quickly
  setTimeout(() => process.exit(0), 100);
} catch (e) {
  console.log('Error creating WebSocket (expected):', e.message.substring(0, 50));
  // Node.js native WebSocket does have .addEventListener but NOT .on
  console.log('\nNode.js native WebSocket does NOT have .on() method!');
  console.log('We need to use the ws npm module instead, or wrap the native WebSocket.');
}
