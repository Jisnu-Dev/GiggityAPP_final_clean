/**
 * This file contains utilities for interacting with the file system on a PC.
 * These functions are used in development mode when running on PC/Web.
 * 
 * In a production environment on a mobile device, these functions are not used.
 * Instead, the app uses Expo's FileSystem API.
 */

// When running in the browser, we'll use a server-side proxy for file operations
const API_BASE_URL = 'http://localhost:3001/api/files'; // This should point to your Node.js server

/**
 * Check if a file exists
 * @param filePath Path to the file to check
 */
export const fileExistsAsync = async (filePath: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/exists?path=${encodeURIComponent(filePath)}`);
    const data = await response.json();
    return data.exists;
  } catch (error) {
    console.error('Error checking if file exists:', error);
    return false;
  }
};

/**
 * Check if a directory exists
 * @param dirPath Path to the directory to check
 */
export const directoryExistsAsync = async (dirPath: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/directory/exists?path=${encodeURIComponent(dirPath)}`);
    const data = await response.json();
    return data.exists;
  } catch (error) {
    console.error('Error checking if directory exists:', error);
    return false;
  }
};

/**
 * Create a directory
 * @param dirPath Path to the directory to create
 */
export const makeDirectoryAsync = async (dirPath: string): Promise<void> => {
  try {
    await fetch(`${API_BASE_URL}/directory/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: dirPath }),
    });
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
};

/**
 * Read a file's contents
 * @param filePath Path to the file to read
 */
export const readFileAsync = async (filePath: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/read?path=${encodeURIComponent(filePath)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
};

/**
 * Write content to a file
 * @param filePath Path to the file to write
 * @param content Content to write to the file
 */
export const writeFileAsync = async (filePath: string, content: string): Promise<void> => {
  try {
    await fetch(`${API_BASE_URL}/write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: filePath, content }),
    });
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
};

/**
 * List the contents of a directory
 * @param dirPath Path to the directory to list
 */
export const readDirectoryAsync = async (dirPath: string): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/directory/list?path=${encodeURIComponent(dirPath)}`);
    const data = await response.json();
    return data.files;
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
};

/**
 * Delete a file
 * @param filePath Path to the file to delete
 */
export const deleteFileAsync = async (filePath: string): Promise<void> => {
  try {
    await fetch(`${API_BASE_URL}/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: filePath }),
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

// This is a mock implementation for direct Node.js file operations
// In a real app, you'd need to set up a small Node.js server to handle file operations
// For development purposes, you could run a server with Express.js
/*
  import * as fs from 'fs';
  import * as path from 'path';

  export const fileExistsAsync = async (filePath: string): Promise<boolean> => {
    return fs.existsSync(filePath);
  };

  export const directoryExistsAsync = async (dirPath: string): Promise<boolean> => {
    return fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory();
  };

  export const makeDirectoryAsync = async (dirPath: string): Promise<void> => {
    fs.mkdirSync(dirPath, { recursive: true });
  };

  export const readFileAsync = async (filePath: string): Promise<string> => {
    return fs.readFileSync(filePath, 'utf-8');
  };

  export const writeFileAsync = async (filePath: string, content: string): Promise<void> => {
    fs.writeFileSync(filePath, content, 'utf-8');
  };

  export const readDirectoryAsync = async (dirPath: string): Promise<string[]> => {
    return fs.readdirSync(dirPath);
  };

  export const deleteFileAsync = async (filePath: string): Promise<void> => {
    fs.unlinkSync(filePath);
  };
*/ 