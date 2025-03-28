// Interface to define operations for face recognition
export interface FaceRecognitionResponse {
  success: boolean;
  message: string;
  data?: any;
}

// Face recognition service URLs
// Use your PC's actual local IP address, not your router's IP or the phone's IP
// You need the IP address that other devices on your network can reach your PC at
const PC_IP_ADDRESS = "192.168.18.16"; // PC's IP address
const SERVER_BASE_URL = `http://${PC_IP_ADDRESS}:5000`;
const FACE_RECOGNITION_ENDPOINTS = {
  addFace: `${SERVER_BASE_URL}/add_face`,
  recognizeFace: `${SERVER_BASE_URL}/recognize_face`,
  checkConnection: `${SERVER_BASE_URL}/status`,
  getLatestRecognition: `${SERVER_BASE_URL}/get_latest_recognition`,
  takePhoto: `${SERVER_BASE_URL}/take_photo`,
};

// Camera stream URLs - use DroidCam format
// The shot.jpg endpoint provides a still image
// The video endpoint provides a video stream
const PHONE_IP_ADDRESS = "192.168.18.76"; // This is your phone's IP running DroidCam
const CAMERA_URL = `http://${PHONE_IP_ADDRESS}:4747`;

// Timeout for API requests (milliseconds)
const REQUEST_TIMEOUT = 30000;

/**
 * Check if the face recognition server is reachable
 */
export const checkServerConnection = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(FACE_RECOGNITION_ENDPOINTS.checkConnection, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    return response.ok;
  } catch (error) {
    console.error('Server connection error:', error);
    return false;
  }
};

/**
 * Check if the camera is reachable
 */
export const checkCameraConnection = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Shorter timeout for camera
    
    const response = await fetch(getRemoteCameraSnapshot(), {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    return response.ok;
  } catch (error) {
    console.error('Camera connection error:', error);
    return false;
  }
};

/**
 * Add a face to the recognition database
 * @param name - Person's name
 * @param imageBase64 - Base64 encoded image with the person's face
 */
export const addFace = async (name: string, imageBase64: string): Promise<FaceRecognitionResponse> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(FACE_RECOGNITION_ENDPOINTS.addFace, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        image: imageBase64,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return { 
      success: true, 
      message: 'Face added successfully',
      data: result
    };
  } catch (error) {
    console.error('Error adding face:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add face'
    };
  }
};

/**
 * Get the remote camera stream URL
 * @returns URL to the remote camera feed
 */
export const getRemoteCameraStream = (): string => {
  return `${CAMERA_URL}/video`;
};

/**
 * Get the remote camera snapshot URL
 * @returns URL to get a snapshot from the remote camera
 */
export const getRemoteCameraSnapshot = (): string => {
  return `${CAMERA_URL}/shot.jpg`;
};

/**
 * Get an image from the remote camera
 * Returns a blob that can be used as an image source
 */
export const getCameraImage = async (): Promise<Blob> => {
  try {
    const response = await fetch(getRemoteCameraSnapshot());
    if (!response.ok) {
      throw new Error(`Failed to fetch camera image: ${response.status} ${response.statusText}`);
    }
    return await response.blob();
  } catch (error) {
    console.error('Error getting camera image:', error);
    throw error;
  }
};

/**
 * Utility to start real-time face recognition on the server
 */
export const startRealtimeRecognition = async (): Promise<FaceRecognitionResponse> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(`${SERVER_BASE_URL}/start_realtime_recognition`, {
      method: 'POST',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return { 
      success: true, 
      message: 'Real-time recognition started',
      data: result
    };
  } catch (error) {
    console.error('Error starting real-time recognition:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to start real-time recognition'
    };
  }
};

/**
 * Utility to stop real-time face recognition on the server
 */
export const stopRealtimeRecognition = async (): Promise<FaceRecognitionResponse> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(`${SERVER_BASE_URL}/stop_realtime_recognition`, {
      method: 'POST',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return { 
      success: true, 
      message: 'Real-time recognition stopped',
      data: result
    };
  } catch (error) {
    console.error('Error stopping real-time recognition:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to stop real-time recognition'
    };
  }
};

/**
 * Convert a local image URI to base64
 */
export const imageToBase64 = async (uri: string): Promise<string> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove the data:image/jpeg;base64, prefix
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert image to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
};

/**
 * Get the latest face recognition result from the server
 * Returns information about the most recently detected face
 */
export const getLatestRecognition = async (): Promise<any> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(FACE_RECOGNITION_ENDPOINTS.getLatestRecognition, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting latest recognition result:', error);
    return {
      success: false,
      has_result: false,
      message: error instanceof Error ? error.message : 'Failed to get recognition result'
    };
  }
}; 