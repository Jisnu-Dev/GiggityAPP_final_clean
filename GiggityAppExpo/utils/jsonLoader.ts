import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { JsonLoaderConfig } from '@/types/json';
import { writeFileAsync, readFileAsync, directoryExistsAsync, makeDirectoryAsync, readDirectoryAsync, deleteFileAsync, fileExistsAsync } from './pcFileSystem';

// Base path for PC development environment
const PC_BASE_PATH = 'E:/Documents/cleantryfinal/GiggityAPP_final_clean/TranscriptData';

// Check if running in development environment on PC
// This is a simplified check - in a real app, you might use a more robust method
const isRunningOnDevelopmentPC = () => {
  return __DEV__ && Platform.OS === 'web';
};

// Map of asset paths to their require statements
// This is necessary because dynamic requires aren't supported in React Native
const assetMap: Record<string, any> = {
  'data/example.json': require('../assets/data/example.json'),
  'data/sample-task.json': require('../assets/data/sample-task.json'),
  // Add more assets here as needed
};

/**
 * Load JSON data from a local asset bundled with the app
 * @param assetPath Path to the asset, e.g., 'data/example.json'
 */
export const loadLocalJsonAsset = async <T>(assetPath: string): Promise<T> => {
  try {
    // Use the assetMap to get the statically required asset
    if (assetMap[assetPath]) {
      return assetMap[assetPath] as T;
    }
    
    // Fallback to using Asset API if not in the map
    const asset = Asset.fromModule(require('../assets/data/example.json'));
    await asset.downloadAsync();
    
    if (asset.localUri) {
      const fileContent = await FileSystem.readAsStringAsync(asset.localUri);
      return JSON.parse(fileContent) as T;
    }
    
    throw new Error(`Asset not found: ${assetPath}. Make sure it's added to the assetMap.`);
  } catch (error) {
    console.error('Error loading local JSON asset:', error);
    throw error;
  }
};

/**
 * Get the file path for a file in the TranscriptData folder
 * Uses PC path in development and app's document directory in production
 */
export const getTranscriptDataPath = (folderName: string, fileName?: string): string => {
  if (isRunningOnDevelopmentPC()) {
    // Use PC local directory path
    return fileName
      ? `${PC_BASE_PATH}/${folderName}/${fileName}`
      : `${PC_BASE_PATH}/${folderName}`;
  } else {
    // Use app's document directory
    const documentDir = FileSystem.documentDirectory;
    return fileName
      ? `${documentDir}TranscriptData/${folderName}/${fileName}`
      : `${documentDir}TranscriptData/${folderName}`;
  }
};

/**
 * Load JSON data from a file in the TranscriptData directory
 * @param folderName Name of the folder inside TranscriptData (e.g., 'Task')
 * @param fileName Name of the JSON file (e.g., 'task1.json')
 */
export const loadTranscriptedJson = async <T>(folderName: string, fileName: string): Promise<T> => {
  try {
    // Get the file path based on environment
    const filePath = getTranscriptDataPath(folderName, fileName);
    
    // Check if the file exists and load it
    if (isRunningOnDevelopmentPC()) {
      // Use PC file system utilities
      if (!await fileExistsAsync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      const fileContent = await readFileAsync(filePath);
      return JSON.parse(fileContent) as T;
    } else {
      // Use Expo FileSystem
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      const fileContent = await FileSystem.readAsStringAsync(filePath);
      return JSON.parse(fileContent) as T;
    }
  } catch (error) {
    console.error(`Error loading JSON from TranscriptData/${folderName}/${fileName}:`, error);
    throw error;
  }
};

/**
 * List all JSON files in a TranscriptData subfolder
 * @param folderName Name of the folder inside TranscriptData (e.g., 'Task')
 */
export const listTranscriptedFiles = async (folderName: string): Promise<string[]> => {
  try {
    // Get the folder path based on environment
    const folderPath = getTranscriptDataPath(folderName);
    
    // Check if the folder exists and list files
    if (isRunningOnDevelopmentPC()) {
      // Use PC file system utilities
      if (!await directoryExistsAsync(folderPath)) {
        // Create the folder if it doesn't exist
        await makeDirectoryAsync(folderPath);
        return [];
      }
      
      const files = await readDirectoryAsync(folderPath);
      return files.filter(file => file.endsWith('.json'));
    } else {
      // Use Expo FileSystem
      const folderInfo = await FileSystem.getInfoAsync(folderPath);
      if (!folderInfo.exists) {
        // Create the folder if it doesn't exist
        await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
        return [];
      }
      
      const files = await FileSystem.readDirectoryAsync(folderPath);
      return files.filter(file => file.endsWith('.json'));
    }
  } catch (error) {
    console.error(`Error listing files in TranscriptData/${folderName}:`, error);
    return [];
  }
};

/**
 * Save JSON data to a file in the TranscriptData folder
 * @param folderName Name of the folder inside TranscriptData (e.g., 'Task')
 * @param fileName Name of the JSON file (e.g., 'task1.json')
 * @param data Data to save
 */
export const saveTranscriptedJson = async <T>(folderName: string, fileName: string, data: T): Promise<void> => {
  try {
    // Get the folder path based on environment
    const folderPath = getTranscriptDataPath(folderName);
    const filePath = getTranscriptDataPath(folderName, fileName);
    
    // Convert the data to a JSON string
    const jsonString = JSON.stringify(data, null, 2);
    
    // Check if the folder exists, create it if it doesn't
    if (isRunningOnDevelopmentPC()) {
      // Use PC file system utilities
      if (!await directoryExistsAsync(folderPath)) {
        await makeDirectoryAsync(folderPath);
      }
      
      // Write the JSON string to the file
      await writeFileAsync(filePath, jsonString);
    } else {
      // Use Expo FileSystem
      const folderInfo = await FileSystem.getInfoAsync(folderPath);
      if (!folderInfo.exists) {
        await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
      }
      
      // Write the JSON string to the file
      await FileSystem.writeAsStringAsync(filePath, jsonString);
    }
  } catch (error) {
    console.error(`Error saving JSON to TranscriptData/${folderName}/${fileName}:`, error);
    throw error;
  }
};

/**
 * Delete a file from the TranscriptData folder
 * @param folderName Name of the folder inside TranscriptData (e.g., 'Task')
 * @param fileName Name of the JSON file (e.g., 'task1.json')
 */
export const deleteTranscriptedFile = async (folderName: string, fileName: string): Promise<void> => {
  try {
    // Get the file path based on environment
    const filePath = getTranscriptDataPath(folderName, fileName);
    
    if (isRunningOnDevelopmentPC()) {
      // Use PC file system utilities
      if (await fileExistsAsync(filePath)) {
        await deleteFileAsync(filePath);
      }
    } else {
      // Use Expo FileSystem
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
      }
    }
  } catch (error) {
    console.error(`Error deleting file TranscriptData/${folderName}/${fileName}:`, error);
    throw error;
  }
};

/**
 * Load JSON data from a remote server (useful during development)
 * @param config Server configuration (IP, port, endpoint)
 */
export const loadRemoteJson = async <T>(
  config: Required<JsonLoaderConfig>['remoteServerSettings'], 
  timeoutMs: number = 10000
): Promise<T> => {
  const { ip, port, endpoint } = config;
  const url = `http://${ip}:${port}/${endpoint}`;
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }
    
    const data = await response.json();
    return data as T;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    console.error('Error loading remote JSON:', error);
    throw error;
  }
};

/**
 * Load JSON data using provided configuration
 * Will try local asset or remote server based on config
 */
export const loadJson = async <T>(config: JsonLoaderConfig): Promise<T> => {
  try {
    if (config.useLocalAsset && config.localAssetPath) {
      return await loadLocalJsonAsset<T>(config.localAssetPath);
    } else if (!config.useLocalAsset && config.remoteServerSettings) {
      const timeoutMs = config.timeoutMs || 10000;
      return await loadRemoteJson<T>(config.remoteServerSettings, timeoutMs);
    } else {
      throw new Error('Invalid configuration: missing required parameters');
    }
  } catch (error) {
    console.error('Error loading JSON:', error);
    throw error;
  }
};

/**
 * Get local device IP address (for development)
 * Note: This is a placeholder. In a real app, you'd need a more robust solution
 * to determine the device's IP address.
 */
export const getDeviceLocalIp = (): string => {
  // This is a simplified example
  // In practice, you might need to use a native module or external service
  return '192.168.1.X'; // Replace with actual logic to get IP
};

/**
 * Get the TransData folder path in the root directory
 */
export const getTransDataPath = (fileName?: string): string => {
  if (isRunningOnDevelopmentPC()) {
    // On PC, use the exact path to TransData
    return fileName
      ? `E:/Documents/cleantryfinal/GiggityAPP_final_clean/TransData/${fileName}`
      : `E:/Documents/cleantryfinal/GiggityAPP_final_clean/TransData`;
  } else {
    // On mobile, use app's document directory
    const documentDir = FileSystem.documentDirectory;
    return fileName
      ? `${documentDir}TransData/${fileName}`
      : `${documentDir}TransData`;
  }
};

/**
 * Check if the TransData directory exists
 */
export const transDataExists = async (): Promise<boolean> => {
  const path = getTransDataPath();
  
  if (isRunningOnDevelopmentPC()) {
    return await directoryExistsAsync(path);
  } else {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists && info.isDirectory;
  }
};

/**
 * Get ACTUAL files from TransData - no caching
 */
export const getTransDataFiles = async (): Promise<string[]> => {
  try {
    const path = getTransDataPath();
    console.log("DIRECT ACCESS: Reading from", path);
    
    // Check if directory exists
    const exists = await transDataExists();
    if (!exists) {
      console.log("DIRECT ACCESS: TransData folder doesn't exist!");
      return [];
    }
    
    // Read directory contents directly
    let files: string[] = [];
    if (isRunningOnDevelopmentPC()) {
      files = await readDirectoryAsync(path);
    } else {
      files = await FileSystem.readDirectoryAsync(path);
    }
    
    // Filter only JSON files
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    console.log("DIRECT ACCESS: Found JSON files:", jsonFiles);
    
    return jsonFiles;
  } catch (error) {
    console.error("DIRECT ACCESS ERROR:", error);
    return [];
  }
}

/**
 * Load a specific JSON file from TransData - no caching
 */
export const loadTransDataFile = async <T>(fileName: string): Promise<T> => {
  try {
    const path = getTransDataPath(fileName);
    console.log("DIRECT ACCESS: Loading file", path);
    
    // Check if file exists
    let exists = false;
    if (isRunningOnDevelopmentPC()) {
      exists = await fileExistsAsync(path);
    } else {
      const info = await FileSystem.getInfoAsync(path);
      exists = info.exists;
    }
    
    if (!exists) {
      console.log("DIRECT ACCESS: File doesn't exist:", path);
      throw new Error(`File not found: ${fileName}`);
    }
    
    // Read file contents directly
    let content = "";
    if (isRunningOnDevelopmentPC()) {
      content = await readFileAsync(path);
    } else {
      content = await FileSystem.readAsStringAsync(path);
    }
    
    // Parse JSON
    return JSON.parse(content) as T;
  } catch (error) {
    console.error("DIRECT ACCESS ERROR loading file:", error);
    throw error;
  }
} 