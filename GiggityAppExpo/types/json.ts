/**
 * Generic interface for JSON data loading responses
 */
export interface JsonLoadResponse<T> {
  isLoading: boolean;
  data: T | null;
  error: string | null;
}

/**
 * Configuration options for JSON loader
 */
export interface JsonLoaderConfig {
  // Use local bundled asset or remote server
  useLocalAsset: boolean;
  
  // Local asset path (for bundled JSON)
  localAssetPath?: string;
  
  // Remote server settings (for development)
  remoteServerSettings?: {
    ip: string;
    port: number;
    endpoint: string;
  };
  
  // Optional timeout in milliseconds
  timeoutMs?: number;
}

/**
 * Generic data item interface (example - customize based on your data)
 */
export interface DataItem {
  id: string | number;
  [key: string]: any;
} 