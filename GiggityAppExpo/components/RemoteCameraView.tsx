import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RemoteCameraViewProps {
  streamUrl: string;
  onError?: () => void;
  onRetry?: () => void;
}

export const RemoteCameraView: React.FC<RemoteCameraViewProps> = ({ streamUrl, onError, onRetry }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [imageSource, setImageSource] = useState({ uri: `${streamUrl}?timestamp=${Date.now()}` });
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Set up image refreshing to simulate a video stream
  useEffect(() => {
    startImageRefresh();

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [streamUrl, refreshKey]);

  const startImageRefresh = () => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }

    // Refresh the image every 200ms to create a live feed effect
    refreshInterval.current = setInterval(() => {
      if (!hasError) {
        setImageSource({ uri: `${streamUrl}?timestamp=${Date.now()}` });
      }
    }, 200);
  };

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleLoadSuccess = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleLoadError = () => {
    setIsLoading(false);
    setHasError(true);
    
    // Stop refreshing when we have an error
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
      refreshInterval.current = null;
    }

    if (onError) {
      onError();
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setRefreshKey(prev => prev + 1);
    startImageRefresh();
    
    if (onRetry) {
      onRetry();
    }
  };

  return (
    <View style={styles.container}>
      {/* Camera feed (Image component instead of WebView) */}
      <Image
        key={`camera-image-${refreshKey}`}
        source={imageSource}
        style={styles.cameraFeed}
        onLoadStart={handleLoadStart}
        onLoad={handleLoadSuccess}
        onError={handleLoadError}
        resizeMode="contain"
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066ff" />
          <Text style={styles.loadingText}>Connecting to camera...</Text>
        </View>
      )}
      
      {/* Error overlay */}
      {hasError && (
        <View style={styles.errorContainer}>
          <Ionicons name="camera-outline" size={50} color="#ff5555" />
          <Text style={styles.errorText}>Could not connect to camera</Text>
          <Text style={styles.errorSubtext}>Please check if the camera is accessible at: {streamUrl.split('?')[0]}</Text>
          
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  cameraFeed: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
    zIndex: 10,
  },
  errorText: {
    color: '#ff5555',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#0066ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 