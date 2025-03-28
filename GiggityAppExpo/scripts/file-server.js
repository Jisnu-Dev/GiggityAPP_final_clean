/**
 * Simple Node.js server to handle file system operations
 * This server is used in development mode to allow the web app to interact with the PC's file system
 * 
 * Usage: node scripts/file-server.js
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Base directory for file operations
const BASE_DIR = 'E:/Documents/cleantryfinal/GiggityAPP_final_clean';

// Utility to ensure paths are within the base directory (security measure)
const getValidatedPath = (requestedPath) => {
  const normalizedPath = path.normalize(requestedPath);
  
  // Check if the path is within the base directory
  if (!normalizedPath.startsWith(BASE_DIR)) {
    throw new Error('Access denied: Path is outside the allowed directory');
  }
  
  return normalizedPath;
};

// API Routes

// Check if a file exists
app.get('/api/files/exists', (req, res) => {
  try {
    const filePath = getValidatedPath(req.query.path);
    const exists = fs.existsSync(filePath) && fs.lstatSync(filePath).isFile();
    res.json({ exists });
  } catch (error) {
    console.error('Error checking file existence:', error);
    res.status(400).json({ error: error.message });
  }
});

// Check if a directory exists
app.get('/api/files/directory/exists', (req, res) => {
  try {
    const dirPath = getValidatedPath(req.query.path);
    const exists = fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory();
    res.json({ exists });
  } catch (error) {
    console.error('Error checking directory existence:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create a directory
app.post('/api/files/directory/create', (req, res) => {
  try {
    const dirPath = getValidatedPath(req.body.path);
    fs.mkdirSync(dirPath, { recursive: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating directory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Read a file
app.get('/api/files/read', (req, res) => {
  try {
    const filePath = getValidatedPath(req.query.path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    res.send(content);
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Write to a file
app.post('/api/files/write', (req, res) => {
  try {
    const filePath = getValidatedPath(req.body.path);
    const content = req.body.content;
    
    // Create the directory if it doesn't exist
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    console.error('Error writing file:', error);
    res.status(500).json({ error: error.message });
  }
});

// List directory contents
app.get('/api/files/directory/list', (req, res) => {
  try {
    const dirPath = getValidatedPath(req.query.path);
    
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    const files = fs.readdirSync(dirPath);
    res.json({ files });
  } catch (error) {
    console.error('Error listing directory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a file
app.delete('/api/files/delete', (req, res) => {
  try {
    const filePath = getValidatedPath(req.body.path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`File Server running on http://localhost:${PORT}`);
  console.log(`Base directory: ${BASE_DIR}`);
  console.log('This server allows the web app to access the PC file system');
  console.log('Press Ctrl+C to stop the server');
}); 