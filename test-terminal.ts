import WebSocket from 'ws';

/**
 * Simple test script for terminal WebSocket functionality
 * Usage: tsx test-terminal.ts
 */

const TEST_PROJECT_ID = 'test-project-123';
const TEST_USER_ID = 'test-user-456';
const WS_URL = `ws://localhost:5000/ws?terminal=true&projectId=${TEST_PROJECT_ID}`;

console.log('🧪 Testing Terminal WebSocket Connection...\n');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connected\n');
  
  // Step 1: Authenticate
  console.log('📤 Sending authentication...');
  ws.send(JSON.stringify({
    type: 'auth',
    userId: TEST_USER_ID
  }));
});

ws.on('message', (data: Buffer) => {
  const message = JSON.parse(data.toString());
  console.log('📥 Received:', JSON.stringify(message, null, 2), '\n');
  
  // Step 2: After auth success, send a simple echo command
  if (message.type === 'auth_success') {
    console.log('📤 Executing test command: echo "Hello from terminal!"');
    ws.send(JSON.stringify({
      type: 'execute',
      command: 'echo "Hello from terminal!"'
    }));
  }
  
  // Step 3: After exit, test command history
  if (message.type === 'exit') {
    console.log('📤 Requesting command history...');
    ws.send(JSON.stringify({
      type: 'history'
    }));
  }
  
  // Step 4: After history, test ping
  if (message.type === 'history') {
    console.log('📤 Testing ping...');
    ws.send(JSON.stringify({
      type: 'ping'
    }));
  }
  
  // Step 5: After pong, close connection
  if (message.type === 'pong') {
    console.log('✅ All tests passed! Closing connection...\n');
    ws.close();
  }
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
  process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('❌ Test timeout - closing connection');
  ws.close();
  process.exit(1);
}, 10000);
