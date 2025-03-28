import os
import sys
import cv2
import numpy as np
import base64
import argparse
import threading
import json
import logging
import time
import traceback
import queue
from datetime import datetime
from flask import Flask, request, jsonify, Response, send_file
from flask_cors import CORS
from gevent.pywsgi import WSGIServer
import subprocess
import importlib
import io

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import the face_recognition_app module
try:
    # Add the current directory to sys.path if not already there
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.append(current_dir)
    
    # Try to import the module
    face_recognition_app = importlib.import_module('face_recognition_app')
    logger.info("Successfully imported face_recognition_app module")
except Exception as e:
    logger.error(f"Error importing face_recognition_app module: {e}")
    traceback.print_exc()
    sys.exit(1)

# Initialize Flask application
app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

# Global variables
recognition_process = None
recognition_lock = threading.Lock()
is_running = False

# Queue for storing recognition results
recognition_results = queue.Queue(maxsize=10)
last_recognition_result = None

# Camera settings - IMPORTANT: Update this to match your DroidCam IP
DROIDCAM_URL = "http://192.168.18.76:4747/video"

# Create the temporary directory for storing images if it doesn't exist
TEMP_DIR = "temp_images"
os.makedirs(TEMP_DIR, exist_ok=True)

# Create directory for storing detected faces
DETECTED_FACES_DIR = "detected_faces"
os.makedirs(DETECTED_FACES_DIR, exist_ok=True)

@app.route('/status', methods=['GET'])
def get_status():
    """Check if the server is running"""
    try:
        with recognition_lock:
            return jsonify({
                "status": "ok",
                "is_recognition_running": is_running
            }), 200
    except Exception as e:
        logger.error(f"Error in status endpoint: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/add_face', methods=['POST'])
def add_face():
    """Add a face to the recognition database"""
    global DROIDCAM_URL
    
    try:
        # Check if recognition is running
        with recognition_lock:
            if is_running:
                return jsonify({"success": False, "message": "Cannot add face while recognition is running"}), 400
        
        # Get request data
        data = request.json
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400
        
        name = data.get('name')
        image_base64 = data.get('image')
        
        if not name or not image_base64:
            return jsonify({"success": False, "message": "Name and image are required"}), 400
        
        # Convert base64 to image
        try:
            # If the image_base64 has a prefix like 'data:image/jpeg;base64,'
            if ',' in image_base64:
                image_base64 = image_base64.split(',')[1]
            
            image_data = base64.b64decode(image_base64)
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                return jsonify({"success": False, "message": "Invalid image data"}), 400
            
            # Save image to temporary file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            temp_filename = os.path.join(TEMP_DIR, f"{timestamp}.jpg")
            cv2.imwrite(temp_filename, image)
            
            # Call face_recognition_app's add_face function
            face_recognition_app.add_face(name, camera_type=face_recognition_app.CAMERA_TYPE_DROIDCAM, droidcam_url=DROIDCAM_URL)
            
            # Remove temp file
            if os.path.exists(temp_filename):
                os.remove(temp_filename)
            
            return jsonify({
                "success": True,
                "message": f"Face for {name} added successfully"
            }), 200
            
        except Exception as e:
            logger.error(f"Error processing image: {e}")
            traceback.print_exc()
            return jsonify({"success": False, "message": f"Error processing image: {str(e)}"}), 500
    
    except Exception as e:
        logger.error(f"Error in add_face endpoint: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

# Function to save recognized face and add to results queue
def recognition_callback(face_obj, name, confidence):
    """Callback function that receives recognition results"""
    global last_recognition_result
    
    try:
        if face_obj is None or name is None:
            return
        
        # Save the detected face image
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        bbox = face_obj.bbox.astype(int)
        
        # Extract face from image
        face_img = face_obj.orig_img[bbox[1]:bbox[3], bbox[0]:bbox[2]]
        
        # Save face image
        img_path = os.path.join(DETECTED_FACES_DIR, f"{name}_{timestamp}.jpg")
        cv2.imwrite(img_path, face_img)
        
        # Create result object
        result = {
            "name": name,
            "confidence": float(confidence),
            "timestamp": timestamp,
            "image_path": img_path
        }
        
        # Only add to queue if it's a new recognition (different from last one)
        if last_recognition_result is None or last_recognition_result["name"] != name:
            # Try to add to queue, but don't block if queue is full
            try:
                recognition_results.put(result, block=False)
            except queue.Full:
                # Queue is full, remove oldest item and add new one
                recognition_results.get()
                recognition_results.put(result)
        
        last_recognition_result = result
        
    except Exception as e:
        logger.error(f"Error in recognition callback: {e}")
        traceback.print_exc()

# Custom face recognition worker that uses the callback
def face_recognition_worker(droidcam_url):
    """Worker thread that runs face recognition and calls the callback with results"""
    try:
        # Initialize face recognition
        app = face_recognition_app.FaceAnalysis(name='buffalo_l', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
        app.prepare(ctx_id=0, det_size=(320, 320))
        
        # Load the face database
        database_file = "faces_db/face_database.pkl"
        if not os.path.exists(database_file):
            logger.error("Face database not found")
            return
        
        with open(database_file, 'rb') as f:
            face_db = face_recognition_app.pickle.load(f)
        
        # Print database info
        logger.info(f"Loaded database with {len(face_db)} identities:")
        for db_name, data in face_db.items():
            display_name = data.get("display_name", db_name)
            samples = len(data["embeddings"])
            logger.info(f"  - {display_name}: {samples} face samples")
        
        # Initialize camera
        camera = face_recognition_app.DroidCam(droidcam_url)
        if not camera.isOpened():
            logger.error("Could not open camera")
            return
        
        # Create face tracker
        face_tracker = face_recognition_app.FaceTracker(max_age=10)
        
        # FPS tracking
        frame_count = 0
        skip_count = 0
        start_time = time.time()
        fps = 0
        
        # Main recognition loop
        while True:
            # Check if we should stop
            with recognition_lock:
                if not is_running:
                    break
            
            # Read frame from camera
            ret, frame = camera.read()
            if not ret or frame is None:
                logger.error("Failed to grab frame")
                time.sleep(0.1)
                continue
            
            # Process every Nth frame for better performance
            skip_count += 1
            if skip_count % 2 != 0:  # Skip every 2nd frame
                continue
            
            # Update FPS calculation
            frame_count += 1
            elapsed_time = time.time() - start_time
            if frame_count % 10 == 0 or elapsed_time >= 1.0:  # Update FPS every 10 frames or 1 second
                fps = frame_count / elapsed_time if elapsed_time > 0 else 0
                frame_count = 0
                start_time = time.time()
            
            # Detect faces in frame
            faces = app.get(frame)
            
            # Update tracker with current detections
            tracked_faces = face_tracker.update(faces)
            
            # Process each tracked face
            for face_id, track_data in tracked_faces.items():
                face_obj = track_data['face_obj']
                current_embedding = track_data['embedding']
                
                # Find the closest match in the database
                best_match_name = "Unknown"
                best_match_score = 0
                
                for db_name, data in face_db.items():
                    for embedding, _ in data["embeddings"]:
                        similarity = np.dot(current_embedding, embedding)
                        
                        if similarity > best_match_score and similarity > 0.5:  # Threshold for similarity
                            best_match_score = similarity
                            best_match_name = data.get("display_name", db_name)
                
                # Call callback with recognition result
                if best_match_name != "Unknown":
                    recognition_callback(face_obj, best_match_name, best_match_score)
            
            # Sleep a tiny bit to avoid maxing out CPU
            time.sleep(0.01)
    
    except Exception as e:
        logger.error(f"Error in face recognition worker: {e}")
        traceback.print_exc()
    finally:
        # Clean up
        if 'camera' in locals():
            camera.release()

@app.route('/start_realtime_recognition', methods=['POST'])
def start_realtime_recognition():
    """Start real-time face recognition"""
    global recognition_process, is_running
    
    with recognition_lock:
        if is_running:
            return jsonify({"success": False, "message": "Recognition is already running"}), 400
        
        try:
            # Clear the results queue
            while not recognition_results.empty():
                recognition_results.get()
            
            # Start the recognition process
            recognition_thread = threading.Thread(
                target=face_recognition_worker,
                args=(DROIDCAM_URL,)
            )
            recognition_thread.daemon = True
            recognition_thread.start()
            
            is_running = True
            
            return jsonify({
                "success": True,
                "message": "Real-time recognition started"
            }), 200
            
        except Exception as e:
            logger.error(f"Error starting real-time recognition: {e}")
            traceback.print_exc()
            return jsonify({"success": False, "message": str(e)}), 500

@app.route('/stop_realtime_recognition', methods=['POST'])
def stop_realtime_recognition():
    """Stop real-time face recognition"""
    global recognition_process, is_running
    
    with recognition_lock:
        if not is_running:
            return jsonify({"success": False, "message": "Recognition is not running"}), 400
        
        try:
            # Stop the recognition process
            is_running = False
            
            # Clear the results queue
            while not recognition_results.empty():
                recognition_results.get()
            
            return jsonify({
                "success": True,
                "message": "Real-time recognition stopped"
            }), 200
            
        except Exception as e:
            logger.error(f"Error stopping real-time recognition: {e}")
            traceback.print_exc()
            return jsonify({"success": False, "message": str(e)}), 500

@app.route('/get_latest_recognition', methods=['GET'])
def get_latest_recognition():
    """Get the latest recognition result"""
    try:
        if recognition_results.empty():
            return jsonify({
                "success": True,
                "has_result": False,
                "message": "No recognition results available"
            }), 200
        
        # Get the latest result without removing it
        result = recognition_results.get()
        
        # If the image path exists, encode it as base64
        image_base64 = None
        if 'image_path' in result and os.path.exists(result['image_path']):
            with open(result['image_path'], 'rb') as img_file:
                image_base64 = base64.b64encode(img_file.read()).decode('utf-8')
        
        return jsonify({
            "success": True,
            "has_result": True,
            "name": result['name'],
            "confidence": result['confidence'],
            "timestamp": result['timestamp'],
            "image_base64": image_base64
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting latest recognition: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/take_photo', methods=['GET'])
def take_photo():
    """Take a photo using the DroidCam"""
    try:
        # Open camera connection
        camera = face_recognition_app.DroidCam(DROIDCAM_URL)
        if not camera.isOpened():
            return jsonify({"success": False, "message": "Could not connect to camera"}), 500
        
        # Read a frame
        ret, frame = camera.read()
        camera.release()
        
        if not ret or frame is None:
            return jsonify({"success": False, "message": "Failed to grab frame from camera"}), 500
        
        # Convert frame to JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        
        # Convert to base64
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            "success": True,
            "image_base64": image_base64
        }), 200
        
    except Exception as e:
        logger.error(f"Error taking photo: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/get_saved_faces', methods=['GET'])
def get_saved_faces():
    """Get the list of saved faces"""
    try:
        # Get the list of saved faces from the database file
        database_file = "faces_db/face_database.pkl"
        if not os.path.exists(database_file):
            return jsonify({"success": True, "faces": []}), 200
        
        # Load the database using face_recognition_app's code
        faces = []
        
        # For each face in the database, return name and sample count
        with open(database_file, 'rb') as f:
            face_db = face_recognition_app.pickle.load(f)
            
            for db_name, data in face_db.items():
                display_name = data.get("display_name", db_name)
                samples = len(data["embeddings"])
                
                # Get the first image path for this face if available
                image_path = None
                if "image_paths" in data and len(data["image_paths"]) > 0:
                    image_path = data["image_paths"][0]
                
                faces.append({
                    "id": db_name,
                    "name": display_name,
                    "sample_count": samples,
                    "image_path": image_path
                })
        
        return jsonify({
            "success": True,
            "faces": faces
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting saved faces: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/face_image/<face_id>', methods=['GET'])
def get_face_image(face_id):
    """Get a face image by ID"""
    try:
        # Load the database
        database_file = "faces_db/face_database.pkl"
        if not os.path.exists(database_file):
            return jsonify({"success": False, "message": "Face database not found"}), 404
        
        with open(database_file, 'rb') as f:
            face_db = face_recognition_app.pickle.load(f)
            
            if face_id not in face_db:
                return jsonify({"success": False, "message": f"Face ID {face_id} not found"}), 404
            
            data = face_db[face_id]
            if "image_paths" not in data or not data["image_paths"]:
                return jsonify({"success": False, "message": "No image found for this face"}), 404
            
            image_path = data["image_paths"][0]
            if not os.path.exists(image_path):
                return jsonify({"success": False, "message": "Image file not found"}), 404
            
            # Return the image file
            return send_file(image_path, mimetype='image/jpeg')
    
    except Exception as e:
        logger.error(f"Error getting face image: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

def main():
    """Main function to start the API server"""
    parser = argparse.ArgumentParser(description="Face Recognition API Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to run the server on")
    parser.add_argument("--port", type=int, default=5000, help="Port to run the server on")
    parser.add_argument("--debug", action="store_true", help="Run in debug mode")
    parser.add_argument("--camera", default=DROIDCAM_URL, help="DroidCam URL")
    
    args = parser.parse_args()
    
    # Update global camera URL if provided
    global DROIDCAM_URL
    if args.camera:
        DROIDCAM_URL = args.camera
    
    logger.info(f"Using camera: {DROIDCAM_URL}")
    logger.info(f"Starting Face Recognition API Server on {args.host}:{args.port}")
    
    if args.debug:
        app.run(host=args.host, port=args.port, debug=True)
    else:
        # Use gevent WSGI server for production
        http_server = WSGIServer((args.host, args.port), app)
        http_server.serve_forever()

if __name__ == "__main__":
    main() 