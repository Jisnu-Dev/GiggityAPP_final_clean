import os
import sys
import cv2
import numpy as np
import pickle
import insightface
import time
import threading
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Define camera types
CAMERA_TYPE_LAPTOP = 'laptop'
CAMERA_TYPE_DROIDCAM = 'droidcam'

# Default camera to use
DEFAULT_CAMERA_TYPE = CAMERA_TYPE_DROIDCAM
DEFAULT_DROIDCAM_URL = "http://192.168.18.76:4747/video"

# Face database directory
FACES_DB_DIR = "faces_db"
os.makedirs(FACES_DB_DIR, exist_ok=True)

# Temp directory for processing
TEMP_DIR = "temp_images"
os.makedirs(TEMP_DIR, exist_ok=True)

# Load InsightFace model
def get_face_analysis():
    face_app = FaceAnalysis(name='buffalo_l', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
    face_app.prepare(ctx_id=0, det_size=(320, 320))
    return face_app

# Camera classes
class DroidCam:
    def __init__(self, url=DEFAULT_DROIDCAM_URL):
        self.url = url
        self.cap = cv2.VideoCapture(url)
        logger.info(f"Initialized DroidCam with URL: {url}")
        
        # Check if camera opened successfully
        if not self.cap.isOpened():
            logger.error(f"Failed to open DroidCam at {url}")
            raise Exception(f"Failed to open DroidCam at {url}")
    
    def read(self):
        if not self.cap.isOpened():
            try:
                self.cap = cv2.VideoCapture(self.url)
                if not self.cap.isOpened():
                    return False, None
            except Exception as e:
                logger.error(f"Error reconnecting to DroidCam: {e}")
                return False, None
        
        return self.cap.read()
    
    def isOpened(self):
        return self.cap.isOpened()
    
    def release(self):
        self.cap.release()

class LaptopCamera:
    def __init__(self, camera_id=0):
        self.camera_id = camera_id
        self.cap = cv2.VideoCapture(camera_id)
        logger.info(f"Initialized laptop camera with ID: {camera_id}")
        
        # Check if camera opened successfully
        if not self.cap.isOpened():
            logger.error(f"Failed to open laptop camera {camera_id}")
            raise Exception(f"Failed to open laptop camera {camera_id}")
    
    def read(self):
        if not self.cap.isOpened():
            try:
                self.cap = cv2.VideoCapture(self.camera_id)
                if not self.cap.isOpened():
                    return False, None
            except Exception as e:
                logger.error(f"Error reconnecting to laptop camera: {e}")
                return False, None
        
        return self.cap.read()
    
    def isOpened(self):
        return self.cap.isOpened()
    
    def release(self):
        self.cap.release()

# Face tracker class for better performance
class FaceTracker:
    def __init__(self, max_age=30):
        self.max_age = max_age
        self.tracks = {}
        self.next_id = 0
    
    def update(self, faces):
        # Update age of all existing tracks
        for track_id in list(self.tracks.keys()):
            self.tracks[track_id]['age'] += 1
            # Remove old tracks
            if self.tracks[track_id]['age'] > self.max_age:
                del self.tracks[track_id]
        
        # Empty faces list, just update ages
        if not faces:
            return self.tracks
        
        # Process new detections
        for face in faces:
            # Get embedding from face
            embedding = face.normed_embedding
            
            # Find closest matching track
            best_match_id = None
            best_match_dist = float('inf')
            
            for track_id, track_data in self.tracks.items():
                # Calculate cosine distance (1 - dot product for normalized vectors)
                dist = 1.0 - np.dot(embedding, track_data['embedding'])
                
                if dist < best_match_dist and dist < 0.3:  # Distance threshold
                    best_match_dist = dist
                    best_match_id = track_id
            
            # Update matched track or create new track
            if best_match_id is not None:
                # Update existing track
                self.tracks[best_match_id]['age'] = 0
                self.tracks[best_match_id]['face_obj'] = face
                # Update embedding with moving average
                alpha = 0.7  # Weight for new embedding
                old_emb = self.tracks[best_match_id]['embedding']
                new_emb = alpha * embedding + (1 - alpha) * old_emb
                self.tracks[best_match_id]['embedding'] = new_emb / np.linalg.norm(new_emb)
            else:
                # Create new track
                self.tracks[self.next_id] = {
                    'face_obj': face,
                    'embedding': embedding,
                    'age': 0
                }
                self.next_id += 1
        
        return self.tracks

# Create a wrapper around InsightFace for easier use
class FaceAnalysis(insightface.app.FaceAnalysis):
    pass

# Add a face to the database
def add_face(name, camera_type=DEFAULT_CAMERA_TYPE, droidcam_url=DEFAULT_DROIDCAM_URL, laptop_camera_id=0):
    """
    Add a face to the database.
    
    Args:
        name: Name of the person
        camera_type: Type of camera to use (laptop or droidcam)
        droidcam_url: URL for DroidCam
        laptop_camera_id: Camera ID for laptop camera
    
    Returns:
        Success status and message
    """
    try:
        # Initialize face recognition
        face_app = get_face_analysis()
        
        # Create or load the face database
        db_file = os.path.join(FACES_DB_DIR, "face_database.pkl")
        if os.path.exists(db_file):
            with open(db_file, 'rb') as f:
                face_db = pickle.load(f)
        else:
            face_db = {}
        
        # Check if name already exists and get a normalized db_name (for storage)
        db_name = name.lower().replace(" ", "_")
        if db_name in face_db:
            # If already exists, we'll add more samples
            logger.info(f"Adding more samples for existing face: {name}")
        else:
            # Create new entry
            face_db[db_name] = {
                "display_name": name,
                "embeddings": [],
                "image_paths": []
            }
        
        # Initialize the appropriate camera
        if camera_type == CAMERA_TYPE_DROIDCAM:
            camera = DroidCam(droidcam_url)
        else:
            camera = LaptopCamera(laptop_camera_id)
        
        if not camera.isOpened():
            return {"success": False, "message": "Could not open camera"}
        
        # Capture multiple frames for better results
        embeddings = []
        images = []
        
        logger.info("Capturing face images, please look at the camera...")
        
        # Take multiple photos with a delay between them
        for i in range(5):
            # Wait a bit between captures to get different angles
            time.sleep(0.5)
            
            # Capture frame
            ret, frame = camera.read()
            if not ret or frame is None:
                continue
            
            # Get face in frame
            faces = face_app.get(frame)
            
            if not faces:
                continue
            
            # Use the face with largest area if multiple detected
            largest_face = None
            largest_area = 0
            
            for face in faces:
                bbox = face.bbox.astype(int)
                area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
                
                if area > largest_area:
                    largest_area = area
                    largest_face = face
            
            if largest_face is not None:
                # Save the face embedding
                embeddings.append((largest_face.normed_embedding, time.time()))
                
                # Save the face image
                bbox = largest_face.bbox.astype(int)
                face_img = frame[bbox[1]:bbox[3], bbox[0]:bbox[2]]
                
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                img_filename = os.path.join(FACES_DB_DIR, f"{db_name}_{timestamp}.jpg")
                cv2.imwrite(img_filename, face_img)
                
                images.append(img_filename)
        
        # Release camera
        camera.release()
        
        # Update database
        if embeddings:
            face_db[db_name]["embeddings"].extend(embeddings)
            face_db[db_name]["image_paths"].extend(images)
            
            # Save the database
            with open(db_file, 'wb') as f:
                pickle.dump(face_db, f)
            
            return {"success": True, "message": f"Added {len(embeddings)} face samples for {name}"}
        else:
            return {"success": False, "message": "No face detected in the captured images"}
    
    except Exception as e:
        logger.error(f"Error adding face: {e}")
        return {"success": False, "message": f"Error adding face: {str(e)}"}

# Main real-time recognition function
def realtime_recognition(camera_type=DEFAULT_CAMERA_TYPE, droidcam_url=DEFAULT_DROIDCAM_URL, laptop_camera_id=0):
    """
    Run real-time face recognition.
    
    Args:
        camera_type: Type of camera to use (laptop or droidcam)
        droidcam_url: URL for DroidCam
        laptop_camera_id: Camera ID for laptop camera
    """
    # Initialize face recognition
    face_app = get_face_analysis()
    
    # Load the face database
    db_file = os.path.join(FACES_DB_DIR, "face_database.pkl")
    if not os.path.exists(db_file):
        logger.error("Face database not found")
        return
    
    with open(db_file, 'rb') as f:
        face_db = pickle.load(f)
    
    # Initialize camera
    if camera_type == CAMERA_TYPE_DROIDCAM:
        camera = DroidCam(droidcam_url)
    else:
        camera = LaptopCamera(laptop_camera_id)
    
    if not camera.isOpened():
        logger.error("Could not open camera")
        return
    
    # Create face tracker
    face_tracker = FaceTracker(max_age=10)
    
    # Create display window
    cv2.namedWindow('Face Recognition', cv2.WINDOW_NORMAL)
    
    # FPS tracking
    frame_count = 0
    start_time = time.time()
    fps = 0
    
    # Print database info
    logger.info(f"Loaded database with {len(face_db)} identities:")
    for db_name, data in face_db.items():
        display_name = data.get("display_name", db_name)
        samples = len(data["embeddings"])
        logger.info(f"  - {display_name}: {samples} face samples")
    
    try:
        # Main recognition loop
        while True:
            # Read frame from camera
            ret, frame = camera.read()
            if not ret or frame is None:
                logger.error("Failed to grab frame")
                time.sleep(0.1)
                continue
            
            # Update FPS calculation
            frame_count += 1
            elapsed_time = time.time() - start_time
            if frame_count % 10 == 0:  # Update FPS every 10 frames
                fps = frame_count / elapsed_time
                frame_count = 0
                start_time = time.time()
            
            # Process every Nth frame for better performance
            if frame_count % 2 != 0:  # Skip every 2nd frame
                continue
            
            # Detect faces in frame
            faces = face_app.get(frame)
            
            # Update tracker with current detections
            tracked_faces = face_tracker.update(faces)
            
            # Draw FPS
            cv2.putText(frame, f"FPS: {fps:.1f}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            
            # Process each tracked face
            for face_id, track_data in tracked_faces.items():
                face_obj = track_data['face_obj']
                current_embedding = track_data['embedding']
                
                # Draw bounding box
                bbox = face_obj.bbox.astype(int)
                cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), (0, 255, 0), 2)
                
                # Find the closest match in the database
                best_match_name = "Unknown"
                best_match_score = 0
                
                for db_name, data in face_db.items():
                    for embedding, _ in data["embeddings"]:
                        similarity = np.dot(current_embedding, embedding)
                        
                        if similarity > best_match_score and similarity > 0.5:  # Threshold for similarity
                            best_match_score = similarity
                            best_match_name = data.get("display_name", db_name)
                
                # Draw name and confidence
                confidence_text = f"{best_match_score:.2f}" if best_match_score > 0 else "?"
                label = f"{best_match_name} ({confidence_text})"
                cv2.putText(frame, label, (bbox[0], bbox[1] - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            
            # Display the frame
            cv2.imshow('Face Recognition', frame)
            
            # Check for exit key
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    
    except KeyboardInterrupt:
        logger.info("Recognition stopped by user")
    except Exception as e:
        logger.error(f"Error in recognition loop: {e}")
    finally:
        # Clean up
        camera.release()
        cv2.destroyAllWindows()

# If run directly, start real-time recognition
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Face Recognition Application")
    parser.add_argument("--camera", choices=["laptop", "droidcam"], default=DEFAULT_CAMERA_TYPE,
                        help="Camera to use (laptop or droidcam)")
    parser.add_argument("--url", default=DEFAULT_DROIDCAM_URL, help="URL for DroidCam")
    parser.add_argument("--add-face", help="Add a face with the given name")
    
    args = parser.parse_args()
    
    if args.add_face:
        # Add a face to the database
        result = add_face(args.add_face, args.camera, args.url)
        print(result["message"])
    else:
        # Run real-time recognition
        realtime_recognition(args.camera, args.url) 