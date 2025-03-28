import { useState, useEffect } from 'react';
import { JsonLoaderConfig, JsonLoadResponse } from '@/types/json';
import { loadJson } from '@/utils/jsonLoader';

/**
 * Custom hook for loading JSON data with built-in state management
 * @param config Configuration for JSON loading
 * @returns Loading state, data, and error information
 */
export const useJsonLoader = <T>(config: JsonLoaderConfig): JsonLoadResponse<T> => {
  const [state, setState] = useState<JsonLoadResponse<T>>({
    isLoading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        const data = await loadJson<T>(config);
        
        if (isMounted) {
          setState({
            isLoading: false,
            data,
            error: null,
          });
        }
      } catch (error) {
        if (isMounted) {
          setState({
            isLoading: false,
            data: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [
    config.useLocalAsset, 
    config.localAssetPath, 
    config.remoteServerSettings?.ip,
    config.remoteServerSettings?.port,
    config.remoteServerSettings?.endpoint,
    config.timeoutMs
  ]);

  return state;
};

/**
 * Helper hook for loading JSON data from a local asset
 * @param assetPath Path to the local asset
 * @returns Loading state, data, and error information
 */
export const useLocalJsonAsset = <T>(assetPath: string, timeoutMs?: number): JsonLoadResponse<T> => {
  const config: JsonLoaderConfig = {
    useLocalAsset: true,
    localAssetPath: assetPath,
    timeoutMs,
  };

  return useJsonLoader<T>(config);
};

/**
 * Helper hook for loading JSON data from a remote server
 * @param ip Server IP address
 * @param port Server port
 * @param endpoint API endpoint
 * @param timeoutMs Timeout in milliseconds
 * @returns Loading state, data, and error information
 */
export const useRemoteJson = <T>(
  ip: string,
  port: number,
  endpoint: string,
  timeoutMs?: number
): JsonLoadResponse<T> => {
  const config: JsonLoaderConfig = {
    useLocalAsset: false,
    remoteServerSettings: {
      ip,
      port,
      endpoint,
    },
    timeoutMs,
  };

  return useJsonLoader<T>(config);
}; 