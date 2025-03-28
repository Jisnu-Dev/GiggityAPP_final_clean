/**
 * JSON Server Setup Script
 * This script sets up a simple JSON server for development purposes.
 * 
 * Requirements:
 * - Node.js installed
 * - npm install json-server -g (or locally)
 * 
 * Usage:
 * - Run this script from the project root: node scripts/setup-json-server.js
 * - It will create a db.json file and start a server on port 3000
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Configuration
const PORT = 3000;
const DB_PATH = path.join(__dirname, '..', 'server-data', 'db.json');
const ASSETS_PATH = path.join(__dirname, '..', 'assets', 'data');

// Create sample data
const sampleData = {
  tasks: [
    {
      "id": 1,
      "title": "Server Task 1",
      "description": "This is a task from the development server",
      "completed": false,
      "priority": "high",
      "tags": ["server", "development"]
    },
    {
      "id": 2,
      "title": "Server Task 2",
      "description": "Another task from the development server",
      "completed": true,
      "priority": "medium",
      "tags": ["server", "testing"]
    },
    {
      "id": 3,
      "title": "Server Task 3",
      "description": "A third task from the development server",
      "completed": false,
      "priority": "low",
      "tags": ["server", "optional"]
    }
  ]
};

// Function to get local IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (non-public) and non-IPv4 addresses
      if (iface.family !== 'IPv4' || iface.internal !== false) {
        continue;
      }
      return iface.address;
    }
  }
  
  return '127.0.0.1'; // Fallback to localhost
}

// Create directory if it doesn't exist
const serverDataDir = path.dirname(DB_PATH);
if (!fs.existsSync(serverDataDir)) {
  console.log(`Creating directory: ${serverDataDir}`);
  fs.mkdirSync(serverDataDir, { recursive: true });
}

// Write sample data to file
console.log(`Writing sample data to ${DB_PATH}`);
fs.writeFileSync(DB_PATH, JSON.stringify(sampleData, null, 2));

// Get local IP address
const localIp = getLocalIpAddress();
console.log(`\nYour local IP address is: ${localIp}`);
console.log(`\nStarting JSON Server on port ${PORT}...`);
console.log(`Your API will be available at http://${localIp}:${PORT}\n`);

// Start JSON server
try {
  console.log(`Running JSON Server on port ${PORT}...`);
  console.log(`Press Ctrl+C to stop the server`);
  console.log('----------------------------------------------');
  execSync(`npx json-server --watch ${DB_PATH} --port ${PORT} --host ${localIp}`, { stdio: 'inherit' });
} catch (error) {
  // This will catch when user terminates the process
  console.log('\nJSON Server stopped');
} 