# Face Recognition Server Setup

This directory contains a face recognition system that works with the GiggityApp mobile application. The system runs on a PC and provides API endpoints for adding faces and performing real-time face recognition using a phone camera via DroidCam.

## Requirements

- Python 3.7+
- OpenCV
- InsightFace library
- Flask
- Flask-CORS
- Gevent
- DroidCam app installed on your phone

## Installation

1. Install the required Python packages:

```bash
pip install opencv-python numpy insightface flask flask-cors gevent
```

2. Make sure you have GPU support set up correctly, as InsightFace performs best with GPU acceleration.

3. Install the DroidCam app on your phone from the Play Store or App Store.

## Running DroidCam

1. Install DroidCam on your mobile device.
2. Make sure your phone and computer are on the same local network.
3. Open the DroidCam app and note the IP address and port displayed (e.g., 192.168.18.76:4747).
4. If needed, update the IP address in the `face_recognition_server.py` file to match your phone's IP.

## Running the Face Recognition Server

1. Start the server:

```bash
python face_recognition_server.py
```

By default, the server runs on all interfaces (0.0.0.0) on port 5000. You can change these settings using command-line arguments:

```bash
python face_recognition_server.py --host 127.0.0.1 --port 8000 --debug
```

2. The server will start and provide the following API endpoints:

- `/status` - Check server status (GET)
- `/add_face` - Add a face to the database (POST)
- `/start_realtime_recognition` - Start real-time face recognition (POST)
- `/stop_realtime_recognition` - Stop real-time face recognition (POST)
- `/get_saved_faces` - Get the list of saved faces (GET)
- `/face_image/<face_id>` - Get a face image by ID (GET)

## Running Stand-alone Face Recognition

You can also run the face recognition system directly without the API server:

```bash
# To add a face to the database
python face_recognition_app.py --mode add --name "Person Name" --camera droidcam --droidcam http://192.168.18.76:4747/video

# To perform real-time recognition
python face_recognition_app.py --mode recognize --camera droidcam --droidcam http://192.168.18.76:4747/video
```

Or you can use the terminal menu interface:

```bash
python face_recognition_app.py
```

## Connecting the Mobile App

The mobile app needs to be configured to connect to your server. The default URL is http://192.168.18.76:5000 for the API and http://192.168.18.76:4747 for the camera feed. Make sure to update these in the app settings if your IP address is different.

## Troubleshooting

- If the face recognition is slow, make sure InsightFace is using the GPU by checking the provider list in the initialization.
- If the camera feed isn't working, check that your phone and computer are on the same network and that the DroidCam app is running correctly.
- Check firewall settings to ensure the API server's port (default 5000) is open.
- If you encounter issues with the camera connection, try using the IP webcam mode or the built-in computer camera as a fallback.

## Security Considerations

This server is designed for use on a local network and does not implement authentication. Do not expose it to the public internet without adding proper security measures. 