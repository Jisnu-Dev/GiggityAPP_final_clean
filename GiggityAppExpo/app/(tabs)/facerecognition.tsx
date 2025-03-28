import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, Image, Alert, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { RemoteCameraView } from '@/components/RemoteCameraView';
import { 
  checkServerConnection, 
  addFace as addFaceToServer, 
  imageToBase64, 
  startRealtimeRecognition,
  stopRealtimeRecognition,
  getCameraImage,
  getLatestRecognition
} from '@/utils/faceRecognitionService';

export default function FaceRecognitionScreen() {
  const colorScheme = useColorScheme();
  const [isServerConnected, setIsServerConnected] = useState<boolean>(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(true);
  const [newFaceName, setNewFaceName] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecognitionMode, setIsRecognitionMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isNameModalVisible, setIsNameModalVisible] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [recognitionResult, setRecognitionResult] = useState<any>(null);
  const recognitionTimer = useRef<any>(null);
  
  // Check server connection on mount
  useEffect(() => {
    checkConnection();
    return () => {
      if (recognitionTimer.current) {
        clearInterval(recognitionTimer.current);
      }
    };
  }, []);

  // Poll for recognition results when in recognition mode
  useEffect(() => {
    if (isRecognitionMode) {
      // Start polling for results
      recognitionTimer.current = setInterval(fetchRecognitionResults, 1000);
    } else {
      // Stop polling
      if (recognitionTimer.current) {
        clearInterval(recognitionTimer.current);
        recognitionTimer.current = null;
      }
    }
    
    return () => {
      if (recognitionTimer.current) {
        clearInterval(recognitionTimer.current);
      }
    };
  }, [isRecognitionMode]);

  // Fetch the latest recognition result
  const fetchRecognitionResults = async () => {
    try {
      const result = await getLatestRecognition();
      
      if (result.success && result.has_result) {
        setRecognitionResult(result);
      }
    } catch (error) {
      console.error('Error fetching recognition results:', error);
    }
  };

  // Check if the face recognition server is reachable
  const checkConnection = async () => {
    setIsCheckingConnection(true);
    try {
      const isConnected = await checkServerConnection();
      setIsServerConnected(isConnected);
      if (!isConnected) {
        setServerMessage('Could not connect to face recognition server');
      } else {
        setServerMessage(null);
      }
    } catch (error) {
      console.error('Error checking server connection:', error);
      setIsServerConnected(false);
      setServerMessage('Error connecting to face recognition server');
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Handle adding a face by directly capturing from the server-connected camera
  const handleAddFace = async () => {
    if (!isServerConnected) {
      Alert.alert('Server Not Connected', 'Please make sure the face recognition server is running.');
      checkConnection();
      return;
    }
    
    try {
      setIsProcessing(true);
      
      // Show a prompt for the name first
      setIsCapturing(true);
      
      // Try to get an image from the camera
      try {
        // Get the image from camera via server
        const blob = await getCameraImage();
        const imageUri = URL.createObjectURL(blob);
        setCapturedImage(imageUri);
        
        // Show the name modal
        setIsNameModalVisible(true);
      } catch (error) {
        console.error('Error capturing image:', error);
        Alert.alert('Camera Error', 'Could not connect to the camera. Make sure DroidCam is running on your phone at 192.168.18.76:4747/video.');
        setIsCapturing(false);
      }
    } catch (error) {
      console.error('Error in add face process:', error);
      Alert.alert('Error', 'Failed to start face addition process');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle adding the captured face to the database
  const handleAddCapturedFace = async () => {
    if (!capturedImage || !newFaceName.trim()) {
      Alert.alert('Missing Information', 'Please provide a name for the face');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Convert image to base64
      const base64Image = await imageToBase64(capturedImage);
      
      // Send to server
      const result = await addFaceToServer(newFaceName.trim(), base64Image);
      
      if (result.success) {
        Alert.alert('Success', `${newFaceName} has been added to the face database`);
        
        // Set as a recognition result to display
        setRecognitionResult({
          success: true,
          has_result: true,
          name: newFaceName.trim(),
          message: 'Face has been added',
          image_base64: base64Image,
          timestamp: new Date().toISOString()
        });
        
        setNewFaceName('');
        setCapturedImage(null);
        setIsNameModalVisible(false);
        setIsCapturing(false);
      } else {
        Alert.alert('Error', result.message || 'Failed to add face');
      }
    } catch (error) {
      console.error('Error adding face:', error);
      Alert.alert('Error', 'Failed to add face to the database');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle real-time face recognition directly on the PC
  const handleStartRecognition = async () => {
    if (!isServerConnected) {
      Alert.alert('Server Not Connected', 'Please make sure the face recognition server is running.');
      checkConnection();
      return;
    }
    
    try {
      setIsProcessing(true);
      
      // Call the server to start recognition using the camera connected to PC
      const result = await startRealtimeRecognition();
      
      if (result.success) {
        setIsRecognitionMode(true);
        setRecognitionResult(null); // Clear previous result
      } else {
        Alert.alert('Error', result.message || 'Failed to start real-time recognition');
      }
    } catch (error) {
      console.error('Error starting recognition:', error);
      Alert.alert('Error', 'Failed to start real-time face recognition');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle stopping real-time face recognition
  const handleStopRecognition = async () => {
    if (!isRecognitionMode) return;
    
    try {
      setIsProcessing(true);
      const result = await stopRealtimeRecognition();
      
      if (result.success) {
        setIsRecognitionMode(false);
      } else {
        Alert.alert('Error', result.message || 'Failed to stop recognition');
      }
    } catch (error) {
      console.error('Error stopping recognition:', error);
      Alert.alert('Error', 'Failed to stop real-time face recognition');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel current operation
  const handleCancel = () => {
    if (isCapturing) {
      setIsCapturing(false);
    }
    if (isRecognitionMode) {
      handleStopRecognition();
    }
    if (isNameModalVisible) {
      setIsNameModalVisible(false);
      setCapturedImage(null);
      setNewFaceName('');
    }
  };

  // If checking server connection, show loading indicator
  if (isCheckingConnection) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066ff" />
          <ThemedText style={styles.loadingText}>Connecting to face recognition server...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Server status message */}
      {serverMessage && (
        <View style={styles.serverMessageContainer}>
          <ThemedText style={styles.serverMessageText}>{serverMessage}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={checkConnection}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {/* Recognition result display */}
      {recognitionResult && recognitionResult.has_result && (
        <View style={styles.resultContainer}>
          {recognitionResult.image_base64 && (
            <Image 
              source={{ uri: `data:image/jpeg;base64,${recognitionResult.image_base64}` }} 
              style={styles.resultImage} 
            />
          )}
          <View style={styles.resultTextContainer}>
            <ThemedText style={styles.resultName}>{recognitionResult.name}</ThemedText>
            <ThemedText style={styles.resultText}>
              {recognitionResult.message || 
                (recognitionResult.confidence 
                  ? `Confidence: ${Math.round(recognitionResult.confidence * 100)}%` 
                  : 'Detected')}
            </ThemedText>
          </View>
        </View>
      )}

      {/* Main content */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.mainButton, { backgroundColor: 'rgba(0, 0, 0, 0.1)' }]}
          onPress={handleAddFace}
          disabled={isProcessing || !isServerConnected || isRecognitionMode}
        >
          <Ionicons 
            name="person-add" 
            size={48} 
            color={isServerConnected && !isRecognitionMode ? "#0066ff" : "#999"} 
          />
          <ThemedText style={styles.mainButtonText}>Add Face</ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.mainButton, 
            { 
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              borderColor: isRecognitionMode ? '#0066ff' : 'transparent',
              borderWidth: isRecognitionMode ? 3 : 0,
            }
          ]}
          onPress={isRecognitionMode ? handleStopRecognition : handleStartRecognition}
          disabled={isProcessing || !isServerConnected}
        >
          <Ionicons 
            name={isRecognitionMode ? "stop-circle" : "scan"} 
            size={48} 
            color={isServerConnected ? "#0066ff" : "#999"} 
          />
          <ThemedText style={styles.mainButtonText}>
            {isRecognitionMode ? "Stop Recognition" : "Recognize Face"}
          </ThemedText>
        </TouchableOpacity>
      </View>
      
      {/* Status indicator */}
      {isProcessing && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color="#0066ff" />
          <ThemedText style={styles.statusText}>
            Processing request...
          </ThemedText>
        </View>
      )}
      
      {isRecognitionMode && !isProcessing && (
        <View style={styles.statusContainer}>
          <View style={styles.activeIndicator} />
          <ThemedText style={styles.statusText}>
            Recognition active on PC
          </ThemedText>
        </View>
      )}
      
      {/* Capture in progress overlay */}
      {isCapturing && isProcessing && (
        <View style={styles.captureOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <ThemedText style={styles.captureText}>Capturing image from camera...</ThemedText>
        </View>
      )}
      
      {/* Name input modal */}
      <Modal
        visible={isNameModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsNameModalVisible(false);
          setIsCapturing(false);
          setCapturedImage(null);
          setNewFaceName('');
        }}
      >
        <View style={styles.modalContainer}>
          <View style={[
            styles.modalContent,
            { backgroundColor: colorScheme === 'dark' ? '#222' : '#fff' }
          ]}>
            <ThemedText style={styles.modalTitle}>What's this person's name?</ThemedText>
            
            {capturedImage && (
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />
            )}
            
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0', color: colorScheme === 'dark' ? '#fff' : '#000' }
              ]}
              placeholder="Enter name"
              placeholderTextColor={colorScheme === 'dark' ? '#aaa' : '#666'}
              value={newFaceName}
              onChangeText={setNewFaceName}
              autoFocus={true}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => {
                  setIsNameModalVisible(false);
                  setIsCapturing(false);
                  setCapturedImage(null);
                  setNewFaceName('');
                }}
                disabled={isProcessing}
              >
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveModalButton]}
                onPress={handleAddCapturedFace}
                disabled={!newFaceName.trim() || isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.modalButtonText}>Save</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
  },
  serverMessageContainer: {
    backgroundColor: '#ff5555',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serverMessageText: {
    color: '#fff',
    flex: 1,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  mainButton: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mainButtonText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
  },
  captureOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  captureText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    marginTop: 16,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
  },
  activeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0f0',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  previewImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 20,
  },
  textInput: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelModalButton: {
    backgroundColor: '#888',
  },
  saveModalButton: {
    backgroundColor: '#0066ff',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultContainer: {
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 14,
  },
}); 