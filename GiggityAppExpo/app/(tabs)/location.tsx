import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  Vibration,
  TouchableOpacity,
  AppState,
  Platform,
  Modal,
  TextInput,
} from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Constants from "expo-constants";
import * as Linking from "expo-linking";

// Create a local ThemedText component that wraps Text with proper TypeScript types
const ThemedText = ({
  style,
  children,
  ...props
}: React.ComponentProps<typeof Text> & { children?: React.ReactNode }) => {
  return (
    <Text style={[{ color: "#fff" }, style]} {...props}>
      {children}
    </Text>
  );
};

// Define storage keys
const HOME_LOCATION_STORAGE_KEY = "home_location";
const NOTIFIED_AT_TEN_METERS_KEY = "notified_at_ten_meters";
const LAST_NOTIFICATION_TIME_KEY = "last_notification_time";
const PERMANENTLY_NOTIFIED_KEY = "permanently_notified";
const THRESHOLD_VALUE_KEY = "threshold_value";

// Define the background task name
const LOCATION_TRACKING_TASK_NAME = "location-tracking";

// Configure notifications to show alerts even when app is in background
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Register the background task
TaskManager.defineTask(LOCATION_TRACKING_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Background task error:", error);
    return;
  }

  if (!data) {
    console.error("No data received in background task");
    return;
  }

  // Extract location from the background task data
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) {
    console.log("No locations received in background");
    return;
  }

  const location = locations[0];
  console.log("Background location update:", location.coords);

  try {
    // First check if we've permanently notified already
    const permanentlyNotifiedStr = await AsyncStorage.getItem(
      PERMANENTLY_NOTIFIED_KEY
    );
    const permanentlyNotified = permanentlyNotifiedStr === "true";

    if (permanentlyNotified) {
      // We've already sent the one-time notification
      console.log(
        "Permanent notification already sent. Skipping background notification."
      );
      return;
    }

    // Get home location from storage
    const homeLocationStr = await AsyncStorage.getItem(
      HOME_LOCATION_STORAGE_KEY
    );
    const homeLocation = homeLocationStr ? JSON.parse(homeLocationStr) : null;

    if (!homeLocation) {
      console.log("No home location set yet, skipping distance check");
      return;
    }

    // Calculate direct distance from home
    const distanceFromHome = calculateDistanceStatic(
      homeLocation.coords.latitude,
      homeLocation.coords.longitude,
      location.coords.latitude,
      location.coords.longitude
    );

    console.log(
      `Background: Distance from home: ${distanceFromHome.toFixed(2)}m`
    );

    // ONLY check distance from home, NOT total distance traveled
    if (distanceFromHome >= 10 && !permanentlyNotified) {
      console.log(
        `Background: 10 meter threshold from home reached (${distanceFromHome.toFixed(
          2
        )}m)`
      );

      // Set permanent notification flag - this will prevent future notifications
      await AsyncStorage.setItem(PERMANENTLY_NOTIFIED_KEY, "true");
      await AsyncStorage.setItem(NOTIFIED_AT_TEN_METERS_KEY, "true");
      await AsyncStorage.setItem(
        LAST_NOTIFICATION_TIME_KEY,
        Date.now().toString()
      );

      // Send notification (only once)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Please Return Home",
          body: `You are now ${distanceFromHome.toFixed(
            1
          )} meters away from your home. For your safety, please return home immediately.`,
          sound: true,
          vibrate: [0, 1000, 500, 1000],
          priority: Notifications.AndroidNotificationPriority.MAX,
          autoDismiss: false,
        },
        trigger: null, // Send immediately
      });

      console.log("🚨 SENT ONE-TIME NOTIFICATION: User has left home zone");
    }
  } catch (error) {
    console.error("Error in background task:", error);
  }
});

// Static distance function that can be used in the background task
function calculateDistanceStatic(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  // Prevent calculations for identical coordinates
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Return distance in meters
  return R * c;
}

export default function LocationTracker() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [distance, setDistance] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [homeLocation, setHomeLocation] =
    useState<Location.LocationObject | null>(null);
  const [askedAboutDestination, setAskedAboutDestination] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const [distanceFromHome, setDistanceFromHome] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isStableAboveThreshold, setIsStableAboveThreshold] = useState(false);
  const [hasTraveledTenMeters, setHasTraveledTenMeters] = useState(false);
  const [thresholdValue, setThresholdValue] = useState(10);
  const lastDistanceFromHome = useRef<number>(0);
  const lastNotificationTime = useRef<number>(0);
  const notifiedAtTenMeters = useRef<boolean>(false);

  // Add timestamps for threshold stability
  const firstTimeAboveThreshold = useRef<number | null>(null);
  const firstTimeBelowThreshold = useRef<number | null>(null);

  // Minimum time above threshold to trigger notification (3 seconds)
  const STABLE_THRESHOLD_TIME = 3000;
  // Minimum time below threshold to reset notification flag (15 seconds)
  const RESET_THRESHOLD_TIME = 15000;
  // Cooldown between notifications (1 minute)
  const NOTIFICATION_COOLDOWN = 60000;

  // Use refs for values that need to be current in callbacks
  const lastLocation = useRef<Location.LocationObject | null>(null);
  const recentLocations = useRef<Location.LocationObject[]>([]);
  const lastSignificantMovement = useRef<number>(Date.now());
  const locationChangeCount = useRef<number>(0);

  // Add app state tracking for background/foreground state
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const [backgroundTracking, setBackgroundTracking] = useState(false);

  // Add a new ref to track consecutive readings above threshold
  const consecutiveAboveThreshold = useRef<number>(0);
  const consecutiveBelowThreshold = useRef<number>(0);

  // Add these new state variables for better location stability
  const [stableLocations, setStableLocations] = useState<
    Location.LocationObject[]
  >([]);
  const locationBuffer = useRef<Location.LocationObject[]>([]);
  const HOME_ZONE_RADIUS = 10; // meters
  const MIN_LOCATIONS_FOR_SMOOTHING = 5;

  // Add a ref to track distance history for stability
  const distanceTrackingArray = useRef<number[]>([]);

  // Add this state variable
  const [lastNotificationDistance, setLastNotificationDistance] =
    useState<number>(0);

  // Calculate distance using enhanced Haversine formula with jitter protection
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    // Prevent calculations for identical coordinates
    if (lat1 === lat2 && lon1 === lon2) return 0;

    const R = 6371000; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    // Using enhanced version of Haversine with better precision
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    // Use arc tangent function for better numerical stability
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Distance in meters with extra precision
    const distance = R * c;

    return distance;
  };

  // Get average location from recent readings to smooth out fluctuations
  const getAverageLocation = (locations: Location.LocationObject[]) => {
    if (locations.length === 0) return null;

    // Ignore locations with poor accuracy (> 20 meters)
    const accurateLocations = locations.filter(
      (loc) => loc.coords.accuracy && loc.coords.accuracy < 20
    );

    if (accurateLocations.length === 0) return locations[locations.length - 1];

    const sumLat = accurateLocations.reduce(
      (sum, loc) => sum + loc.coords.latitude,
      0
    );
    const sumLon = accurateLocations.reduce(
      (sum, loc) => sum + loc.coords.longitude,
      0
    );
    const avgLat = sumLat / accurateLocations.length;
    const avgLon = sumLon / accurateLocations.length;

    return {
      ...accurateLocations[accurateLocations.length - 1],
      coords: {
        ...accurateLocations[accurateLocations.length - 1].coords,
        latitude: avgLat,
        longitude: avgLon,
      },
    };
  };

  // Notify user of movement
  const notifyMovement = (distanceMoved: number) => {
    if (!notificationsEnabled) return;

    // Only notify if it's been at least 5 seconds since the last notification
    const now = Date.now();
    if (now - lastNotificationTime.current < 5000) return;

    lastNotificationTime.current = now;

    // Vibrate in pattern for notification
    Vibration.vibrate([0, 300, 100, 300]);

    Alert.alert(
      "Movement Detected",
      `You have moved ${distanceMoved.toFixed(
        2
      )} meters from your last location.\n\nTotal distance: ${totalDistance.toFixed(
        2
      )} meters.\n\nDistance from home: ${distanceFromHome.toFixed(2)} meters.`,
      [
        {
          text: "OK",
          onPress: () => console.log("Movement notification acknowledged"),
        },
        {
          text: "Disable Alerts",
          onPress: () => {
            setNotificationsEnabled(false);
            console.log("Movement notifications disabled");
          },
          style: "cancel",
        },
      ]
    );
  };

  // Check if movement is significant enough to count
  const isSignificantMovement = (
    newLocation: Location.LocationObject,
    threshold = 0.5 // Reduced from 1 to 0.5 meter for greater sensitivity
  ) => {
    if (!lastLocation.current) return false;

    const dist = calculateDistance(
      lastLocation.current.coords.latitude,
      lastLocation.current.coords.longitude,
      newLocation.coords.latitude,
      newLocation.coords.longitude
    );

    // Only count as movement if:
    // 1. Distance is greater than threshold AND
    // 2. Accuracy is good enough
    return (
      dist > threshold &&
      newLocation.coords.accuracy !== undefined &&
      newLocation.coords.accuracy < 15 // Increased from 10 to 15 to handle varying accuracy
    );
  };

  // Check if user is actually moving based on speed and location changes
  const checkIfMoving = (newLocation: Location.LocationObject) => {
    // Consider moving if:
    // 1. Speed is above 0.05 m/s (reduced from 0.1) OR
    // 2. We've had consistent location changes
    const isMovingBySpeed =
      newLocation.coords.speed !== undefined &&
      newLocation.coords.speed !== null &&
      newLocation.coords.speed > 0.05;

    if (isMovingBySpeed) {
      locationChangeCount.current += 1.5; // Increased to detect movement faster
    } else if (locationChangeCount.current > 0) {
      locationChangeCount.current -= 0.25; // Slower decrease to maintain "moving" state longer
    }

    // Need at least 1.5 consistent speed readings above threshold to consider moving
    return isMovingBySpeed || locationChangeCount.current >= 1.5;
  };

  // Custom cross-platform prompt function
  const showTextInputDialog = (
    title: string,
    message: string,
    onConfirm: (text: string) => void,
    initialValue: string = ""
  ) => {
    if (Platform.OS === "ios") {
      // Use native Alert.prompt for iOS
      Alert.prompt(
        title,
        message,
        [
          {
            text: "Cancel",
            onPress: () => onConfirm(""),
            style: "cancel",
          },
          {
            text: "OK",
            onPress: (text) => onConfirm(text || ""),
          },
        ],
        "plain-text",
        initialValue
      );
    } else {
      // Custom modal implementation for Android
      setModalTitle(title);
      setModalMessage(message);
      setModalText(initialValue);
      setModalCallback(() => onConfirm);
      setModalVisible(true);
    }
  };

  // Define the direct alert version
  const askForDestination = () => {
    if (askedAboutDestination) return;

    setAskedAboutDestination(true);

    console.log("SHOWING DESTINATION OPTIONS DIALOG");

    // Use custom cross-platform text input dialog for everyone
    showTextInputDialog(
      "Where are you going?",
      "Please type your destination:",
      (text) => {
        if (text && text.trim()) {
          setDestination(text.trim());
          console.log(`User entered destination: ${text.trim()}`);
          AsyncStorage.setItem("last_destination", text.trim());
        } else {
          setDestination("Unknown");
          AsyncStorage.setItem("last_destination", "Unknown");
          console.log("User cancelled destination input or entered blank text");
        }
      },
      ""
    );
  };

  // Notify user they're away from home
  const notifyAwayFromHome = (distance: number) => {
    // Check notification cooldown
    const now = Date.now();
    if (now - lastNotificationTime.current < NOTIFICATION_COOLDOWN) {
      console.log(`Notification cooldown active. Skipping notification.`);
      return;
    }

    // Update notification time
    lastNotificationTime.current = now;

    // Save to AsyncStorage for background task
    AsyncStorage.setItem(LAST_NOTIFICATION_TIME_KEY, now.toString());
    AsyncStorage.setItem(NOTIFIED_AT_TEN_METERS_KEY, "true");

    // Strong vibration
    Vibration.vibrate([0, 800, 300, 800]);

    // Alert message for Alzheimer's patients
    Alert.alert(
      "🚨 Please Return Home",
      `You are now ${distance.toFixed(
        2
      )} meters away from your home. For your safety, please return home now.`,
      [
        {
          text: "OK, I'll go back",
          onPress: () => console.log("User acknowledged return home alert"),
          style: "default",
        },
        {
          text: "I'm going somewhere",
          onPress: () => {
            console.log("User is going somewhere");
            // Use cross-platform text input dialog
            showTextInputDialog(
              "Where are you going?",
              "Please type where you are going:",
              (text) => {
                if (text && text.trim()) {
                  setDestination(text.trim());
                  console.log(`User entered destination: ${text.trim()}`);
                  AsyncStorage.setItem("last_destination", text.trim());
                } else {
                  setDestination("Unknown");
                  AsyncStorage.setItem("last_destination", "Unknown");
                  console.log(
                    "User cancelled destination input or entered blank text"
                  );
                }
              }
            );
          },
        },
      ],
      { cancelable: false } // Prevent dismissing by tapping outside
    );

    console.log(
      `🚨 NOTIFICATION SENT: ${distance.toFixed(2)} meters from home`
    );
  };

  const setCurrentLocationAsHome = async () => {
    if (location) {
      setHomeLocation(location);
      lastLocation.current = location;
      setTotalDistance(0); // Reset distance when setting new home
      setDistanceFromHome(0); // Reset distance from home to zero immediately

      // Reset all notification state
      notifiedAtTenMeters.current = false;
      firstTimeAboveThreshold.current = null;
      firstTimeBelowThreshold.current = null;
      lastNotificationTime.current = 0;
      setIsStableAboveThreshold(false);

      // Reset all AsyncStorage notification state
      await AsyncStorage.setItem(NOTIFIED_AT_TEN_METERS_KEY, "false");
      await AsyncStorage.setItem(LAST_NOTIFICATION_TIME_KEY, "0");
      await AsyncStorage.setItem(PERMANENTLY_NOTIFIED_KEY, "false"); // Reset permanent notification flag

      // Store home location in AsyncStorage for background task
      try {
        await AsyncStorage.setItem(
          HOME_LOCATION_STORAGE_KEY,
          JSON.stringify({
            coords: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
            },
          })
        );
        console.log("Home location saved to storage");
      } catch (e) {
        console.error("Error saving home location to storage:", e);
      }

      console.log("Home location set to current location");

      Alert.alert(
        "Home Location Set",
        "Your current location has been set as home. You will receive a notification when you move away from home."
      );
    } else {
      Alert.alert(
        "Error",
        "Cannot set home location. No location data available."
      );
    }
  };

  const resetTracking = () => {
    if (location) {
      // Reset state variables
      setTotalDistance(0);
      setDistance(0);
      setLastNotificationDistance(0);
      lastLocation.current = location;
      setAskedAboutDestination(false);
      setDestination(null);
      setHasTraveledTenMeters(false);

      // Clear all tracking state in AsyncStorage
      Promise.all([
        AsyncStorage.setItem("total_distance", "0"),
        AsyncStorage.setItem("last_notification_distance", "0"),
        AsyncStorage.setItem("hasTraveledTenMeters", "false"),
        AsyncStorage.setItem(NOTIFIED_AT_TEN_METERS_KEY, "false"),
        AsyncStorage.setItem(LAST_NOTIFICATION_TIME_KEY, "0"),
        AsyncStorage.setItem("should_ask_destination", "false"),
        AsyncStorage.setItem(PERMANENTLY_NOTIFIED_KEY, "false"), // Reset permanent notification flag
      ])
        .then(() => {
          console.log("All tracking state reset in AsyncStorage");
        })
        .catch((err) => {
          console.error("Error resetting tracking state:", err);
        });

      // Reset all ref values
      notifiedAtTenMeters.current = false;
      firstTimeAboveThreshold.current = null;
      firstTimeBelowThreshold.current = null;
      setIsStableAboveThreshold(false);
      lastNotificationTime.current = 0;
      distanceTrackingArray.current = [];

      Alert.alert(
        "Tracking Reset",
        "Distance tracking has been reset to zero. You'll now receive one notification when you move away from home."
      );
    }
  };

  const toggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
    Alert.alert(
      notificationsEnabled ? "Notifications Disabled" : "Notifications Enabled",
      notificationsEnabled
        ? "You will no longer receive movement alerts."
        : "You will now receive alerts when you move a significant distance."
    );
  };

  // Function to simulate reaching a distance threshold
  const simulateTenMetersFromHome = async () => {
    if (!location) return;

    // Check if we've already sent the permanent notification
    const permanentlyNotifiedStr = await AsyncStorage.getItem(
      PERMANENTLY_NOTIFIED_KEY
    );
    const permanentlyNotified = permanentlyNotifiedStr === "true";

    if (permanentlyNotified) {
      // Already sent one notification
      Alert.alert(
        "Notification Already Sent",
        "You've already received the one-time notification. Reset notifications to test again.",
        [{ text: "OK" }]
      );
      return;
    }

    // Use the thresholdValue + 0.1 to just exceed it
    const simulatedDistance = thresholdValue + 0.1;

    console.log(`SIMULATING LEAVING HOME: ${simulatedDistance.toFixed(1)}m`);

    // Set permanent notification flag to prevent future notifications
    await AsyncStorage.setItem(PERMANENTLY_NOTIFIED_KEY, "true");
    await AsyncStorage.setItem(NOTIFIED_AT_TEN_METERS_KEY, "true");
    await AsyncStorage.setItem(
      LAST_NOTIFICATION_TIME_KEY,
      Date.now().toString()
    );

    // Strong vibration pattern
    Vibration.vibrate([0, 1000, 500, 1000]);

    // First show the safety checklist
    showSafetyChecklist();

    // Update state
    setTotalDistance(simulatedDistance);
    setLastNotificationDistance(simulatedDistance);
    notifiedAtTenMeters.current = true;

    // Save to AsyncStorage
    AsyncStorage.setItem("total_distance", simulatedDistance.toString());
    AsyncStorage.setItem(
      "last_notification_distance",
      simulatedDistance.toString()
    );

    console.log(`Simulated one-time travel notification shown`);
  };

  const [isInExpoGo, setIsInExpoGo] = useState(false);
  const [backgroundLimitationMessage, setBackgroundLimitationMessage] =
    useState("");

  // Function to start background location updates
  const startBackgroundLocationUpdates = async () => {
    try {
      // Simpler check for Expo Go that's compatible with newer Expo versions
      let runningInExpoGo = false;
      try {
        // Check for development build which indicates we're likely in Expo Go
        // @ts-ignore - Handle potential type mismatch in different Expo versions
        const isDevelopmentBuild = Constants.appOwnership === "expo";
        runningInExpoGo = isDevelopmentBuild;
      } catch (err) {
        console.log("Error checking Expo environment:", err);
      }

      setIsInExpoGo(runningInExpoGo);

      if (runningInExpoGo) {
        console.log(
          "Running in Expo Go - background tracking limitations apply"
        );
        setBackgroundLimitationMessage(
          "Background tracking doesn't work in Expo Go. Please build a development or production app for full functionality."
        );

        // We'll try to start background tracking anyway, but it won't work in Expo Go on real devices
        console.log(
          "Attempting to start background tracking in Expo Go (will work in iOS simulator only)"
        );
      }

      // First, check background permissions
      const { status: backgroundStatus } =
        await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== "granted") {
        console.log("Background location permission denied");
        Alert.alert(
          "Background Location Required",
          "Please enable background location for tracking when the app is in the background.",
          [{ text: "OK" }]
        );
        return;
      }

      console.log("Starting background location tracking...");

      // Stop any existing tasks
      await Location.stopLocationUpdatesAsync(
        LOCATION_TRACKING_TASK_NAME
      ).catch((error) => console.log("No existing task to stop:", error));

      // Start the background task
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000, // Update every 5 seconds in background (to save battery)
        distanceInterval: 5, // Update when moved 5 meters
        foregroundService: {
          notificationTitle: "Location Tracking Active",
          notificationBody:
            "Tracking your location to alert when you move away from home",
          notificationColor: "#4CAF50",
        },
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });

      console.log("Background location tracking started successfully");

      if (!runningInExpoGo) {
        Alert.alert(
          "Background Tracking Active",
          "The app will now track your location and send notifications even when closed."
        );
      }
    } catch (error) {
      console.error("Error starting background location tracking:", error);
      if (Platform.OS === "android") {
        setBackgroundLimitationMessage(
          "Background tracking requires a development or production build on Android. Expo Go doesn't support it."
        );
      }
    }
  };

  // Request notification permissions
  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Notifications permission is needed to alert you when you move away from home."
      );
      return false;
    }
    return true;
  };

  // Handle app state changes (foreground/background/inactive)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      appState.current = nextAppState;
      setAppStateVisible(appState.current);
      console.log("App state changed to:", nextAppState);

      // If app goes to background, make sure background tracking is started
      if (nextAppState === "background") {
        startBackgroundLocationUpdates().catch((err) =>
          console.error(
            "Failed to start background tracking on state change:",
            err
          )
        );
      }
    });

    return () => {
      console.log(
        "Cleaning up location subscription and app state listener..."
      );
      subscription.remove();

      // Attempt to stop background tracking on unmount
      Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME).catch(
        (error) => console.log("Error stopping background task:", error)
      );
    };
  }, []);

  // Request permissions when component mounts
  useEffect(() => {
    (async () => {
      await requestNotificationPermissions();
    })();
  }, []);

  useEffect(() => {
    let locationSubscription;

    const startLocationTracking = async () => {
      try {
        // Start tracking foreground location with highest possible accuracy
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 0.1, // Update every 0.1 meters for more responsive updates (was 0.5)
            timeInterval: 300, // Update every 300ms for more frequent readings (was 500)
            mayShowUserSettingsDialog: true, // Prompt user to enable high accuracy mode
          },
          (newLocation) => {
            // Update current location immediately for more responsive UI
            setLocation(newLocation);

            // Update the last location for calculations
            lastLocation.current = newLocation;

            // Calculate distance from home immediately
            if (homeLocation && newLocation) {
              const distance = calculateDistance(
                homeLocation.coords.latitude,
                homeLocation.coords.longitude,
                newLocation.coords.latitude,
                newLocation.coords.longitude
              );

              setDistanceFromHome(distance);

              // Check notifications with the raw distance
              checkAndNotifyIfNeeded(distance).catch((err) =>
                console.error("Error checking notification status:", err)
              );
            }

            // Add to recent locations for smoothing only if accuracy is good
            if (
              newLocation.coords.accuracy &&
              newLocation.coords.accuracy < 30
            ) {
              recentLocations.current.push(newLocation);
              if (recentLocations.current.length > 5) {
                // Reduced buffer size for faster updates
                recentLocations.current.shift();
              }
            }
          }
        );

        // Enable additional location providers on Android for better accuracy
        if (Platform.OS === "android") {
          try {
            await Location.enableNetworkProviderAsync();
            console.log("Network provider enabled for better accuracy");
          } catch (error) {
            console.log("Could not enable network provider:", error);
          }
        }

        console.log("Started high-accuracy real-time location tracking");
      } catch (error) {
        console.error("Failed to start location tracking:", error);
      }
    };

    // Start location tracking when component mounts
    startLocationTracking();

    // Clean up subscription when component unmounts
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
        console.log("Location tracking stopped");
      }
    };
  }, []);

  // Load home location from storage on app start
  useEffect(() => {
    const loadHomeLocation = async () => {
      try {
        const storedHomeLocation = await AsyncStorage.getItem(
          HOME_LOCATION_STORAGE_KEY
        );
        if (storedHomeLocation) {
          const parsedLocation = JSON.parse(storedHomeLocation);
          setHomeLocation(parsedLocation);
          console.log("Loaded home location from storage");
        }

        // Load threshold value from storage
        const storedThreshold = await AsyncStorage.getItem(THRESHOLD_VALUE_KEY);
        if (storedThreshold) {
          const parsedThreshold = parseInt(storedThreshold, 10);
          setThresholdValue(parsedThreshold);
          console.log(
            `Loaded threshold value from storage: ${parsedThreshold}m`
          );
        }
      } catch (e) {
        console.error("Error loading data from storage:", e);
      }
    };

    loadHomeLocation();
  }, []);

  // Enhanced location smoothing algorithm to eliminate GPS jitter
  const getStableLocation = (newLocation: Location.LocationObject) => {
    // Add to buffer, keep most recent 10 locations
    locationBuffer.current.push(newLocation);
    if (locationBuffer.current.length > 10) {
      locationBuffer.current.shift();
    }

    // Only use accurate locations for smoothing
    const accurateLocations = locationBuffer.current.filter(
      (loc) => loc.coords.accuracy && loc.coords.accuracy < 20
    );

    // If not enough accurate readings, return the most recent one
    if (accurateLocations.length < MIN_LOCATIONS_FOR_SMOOTHING) {
      return newLocation;
    }

    // Sort locations by accuracy (best first)
    const sortedByAccuracy = [...accurateLocations].sort(
      (a, b) => (a.coords.accuracy || 100) - (b.coords.accuracy || 100)
    );

    // Use the top 5 most accurate locations
    const bestLocations = sortedByAccuracy.slice(
      0,
      Math.min(5, sortedByAccuracy.length)
    );

    // Calculate mean position from best locations
    const sumLat = bestLocations.reduce(
      (sum, loc) => sum + loc.coords.latitude,
      0
    );
    const sumLng = bestLocations.reduce(
      (sum, loc) => sum + loc.coords.longitude,
      0
    );
    const avgLat = sumLat / bestLocations.length;
    const avgLng = sumLng / bestLocations.length;

    // Calculate median accuracy
    const accuracies = bestLocations
      .map((loc) => loc.coords.accuracy || 20)
      .sort();
    const medianAccuracy = accuracies[Math.floor(accuracies.length / 2)];

    // Create a stable location object
    const stableLocation = {
      ...newLocation,
      coords: {
        ...newLocation.coords,
        latitude: avgLat,
        longitude: avgLng,
        accuracy: medianAccuracy,
      },
    };

    return stableLocation;
  };

  // Function to check if we're above threshold and should notify
  const checkAndNotifyIfNeeded = async (rawDistanceFromHome: number) => {
    // Only proceed if notifications are enabled
    if (!notificationsEnabled) {
      console.log("Notifications are disabled, skipping check");
      return;
    }

    // Check if we've already sent the permanent notification
    const permanentlyNotifiedStr = await AsyncStorage.getItem(
      PERMANENTLY_NOTIFIED_KEY
    );
    const permanentlyNotified = permanentlyNotifiedStr === "true";

    if (permanentlyNotified) {
      // Already sent the one notification, do nothing
      return;
    }

    // Add distance to tracking array for stability (reduced to 3 samples)
    distanceTrackingArray.current.push(rawDistanceFromHome);
    if (distanceTrackingArray.current.length > 3) {
      distanceTrackingArray.current.shift();
    }

    // Use the most recent reading for faster response
    // Only use median for stability if we have all 3 readings
    let stableDistance = rawDistanceFromHome;

    if (distanceTrackingArray.current.length === 3) {
      const sortedDistances = [...distanceTrackingArray.current].sort(
        (a, b) => a - b
      );
      stableDistance = sortedDistances[1]; // Median of 3 values
    }

    // Use the user-set threshold value instead of hardcoded 10 meters
    const notificationThreshold = thresholdValue;

    // Simplified notification logic
    if (stableDistance > notificationThreshold && !permanentlyNotified) {
      console.log(
        `🏠 LEFT HOME ZONE: ${stableDistance.toFixed(
          2
        )} meters from home (STABLE READING)`
      );

      // Set notification flags - prevents future notifications
      notifiedAtTenMeters.current = true;
      lastNotificationTime.current = Date.now();

      // Save to AsyncStorage for background task and to prevent future notifications
      await AsyncStorage.setItem(NOTIFIED_AT_TEN_METERS_KEY, "true");
      await AsyncStorage.setItem(PERMANENTLY_NOTIFIED_KEY, "true");
      await AsyncStorage.setItem(
        LAST_NOTIFICATION_TIME_KEY,
        Date.now().toString()
      );

      // Vibrate
      Vibration.vibrate([0, 1000, 500, 1000]);

      // First show the safety checklist before asking where they're going
      showSafetyChecklist();

      console.log("🚨 ONE-TIME ALERT SENT: User has left home zone");
    }
  };

  // Enhance the getWeightedAverageLocation function for better filtering
  const getWeightedAverageLocation = (locations: Location.LocationObject[]) => {
    if (locations.length === 0) return null;
    if (locations.length === 1) return locations[0];

    // Return the most recent location for more immediate updates
    // Only smooth when we have multiple good readings
    const goodLocations = locations.filter(
      (loc) => loc.coords.accuracy && loc.coords.accuracy < 20
    );

    // If we have fewer than 3 good locations, just return the most recent one
    if (goodLocations.length < 3) return locations[locations.length - 1];

    // Give more weight to recent locations
    const weights = goodLocations.map((_, index, array) => {
      // Recent locations get more weight
      return Math.pow(2, index) / Math.pow(2, array.length - 1);
    });

    // Normalize weights
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const normalizedWeights = weights.map((w) => w / totalWeight);

    // Calculate weighted average
    let latitude = 0;
    let longitude = 0;

    for (let i = 0; i < goodLocations.length; i++) {
      latitude += goodLocations[i].coords.latitude * normalizedWeights[i];
      longitude += goodLocations[i].coords.longitude * normalizedWeights[i];
    }

    // Return the enhanced weighted average location
    return {
      ...goodLocations[goodLocations.length - 1],
      coords: {
        ...goodLocations[goodLocations.length - 1].coords,
        latitude,
        longitude,
      },
    };
  };

  const isReallyMoving = useRef<boolean>(false);
  const movementBuffer = useRef<number[]>([]);
  const locationAges = useRef<number[]>([]);
  const lastUpdateTime = useRef<number>(Date.now());

  // More robust check if user is actually moving or just experiencing GPS jitter
  const checkIfReallyMoving = (
    newLocation: Location.LocationObject,
    distanceMoved: number
  ) => {
    // Calculate speed in km/h from the GPS data
    const speedKmh = (newLocation.coords.speed || 0) * 3.6;

    // Only consider reliable movements when:
    // 1. The GPS accuracy is good (under 10 meters)
    // 2. Either the speed is significant (>0.5 km/h) OR the distance moved is large compared to accuracy
    const hasGoodAccuracy =
      newLocation.coords.accuracy !== undefined &&
      newLocation.coords.accuracy < 10;
    const hasSignificantSpeed = speedKmh > 0.5;
    const hasSignificantMovement =
      newLocation.coords.accuracy !== undefined &&
      distanceMoved > newLocation.coords.accuracy / 3;

    // Log significant potential movements for debugging
    if (hasSignificantSpeed || hasSignificantMovement) {
      console.log(
        `Movement check: dist=${distanceMoved.toFixed(
          2
        )}m, speed=${speedKmh.toFixed(1)}km/h, acc=${
          newLocation.coords.accuracy !== undefined
            ? newLocation.coords.accuracy.toFixed(1)
            : "undefined"
        }m`
      );
    }

    return hasGoodAccuracy && (hasSignificantSpeed || hasSignificantMovement);
  };

  // Add a function to check if total distance has reached 5 meters
  const checkTotalDistanceThreshold = async (newTotalDistance: number) => {
    // First check if we've already sent a notification permanently
    const permanentlyNotifiedStr = await AsyncStorage.getItem(
      PERMANENTLY_NOTIFIED_KEY
    );
    const permanentlyNotified = permanentlyNotifiedStr === "true";

    if (permanentlyNotified) {
      // We've already sent a notification, don't send any more
      console.log(
        "Notification already sent permanently. Skipping all future notifications."
      );
      return;
    }

    // Only notify once when threshold is crossed (5 meters or more)
    if (newTotalDistance >= 10) {
      console.log(
        `🚶 DISTANCE THRESHOLD REACHED: ${newTotalDistance.toFixed(
          2
        )} meters traveled`
      );

      // Set permanent notification flag to prevent future notifications
      await AsyncStorage.setItem(PERMANENTLY_NOTIFIED_KEY, "true");

      // Store the total distance at which we notified
      setLastNotificationDistance(newTotalDistance);

      // Store state in AsyncStorage
      AsyncStorage.setItem(
        "last_notification_distance",
        newTotalDistance.toString()
      ).catch((err) =>
        console.log("Failed to save last notification distance:", err)
      );

      // Strong vibration pattern
      Vibration.vibrate([0, 1000, 500, 1000]);

      // Show alert asking where they're going (only once, ever)
      setTimeout(() => {
        // Show alert asking where they're going
        Alert.alert(
          "Where are you going?",
          `You've left your home area. Where are you headed?`,
          [
            {
              text: "Just going for a walk",
              onPress: () => {
                console.log("User is just going for a walk");
                setDestination("A walk");
                AsyncStorage.setItem("last_destination", "A walk");
              },
            },
            {
              text: "Going somewhere",
              onPress: () => askForDestination(),
            },
          ],
          { cancelable: false }
        );
        console.log(
          `🚨 ONE-TIME ALERT DISPLAYED - no further alerts will be shown`
        );
      }, 500);
    }
  };

  const [modalVisible, setModalVisible] = useState(false);
  const [modalText, setModalText] = useState("");
  const [modalCallback, setModalCallback] = useState<(text: string) => void>(
    () => {}
  );
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  // Function to reset notification status (add this to the UI)
  const resetNotificationStatus = async () => {
    // Reset all notification flags
    notifiedAtTenMeters.current = false;
    firstTimeAboveThreshold.current = null;
    firstTimeBelowThreshold.current = null;
    lastNotificationTime.current = 0;

    // Reset in AsyncStorage
    await AsyncStorage.setItem(NOTIFIED_AT_TEN_METERS_KEY, "false");
    await AsyncStorage.setItem(LAST_NOTIFICATION_TIME_KEY, "0");
    await AsyncStorage.setItem(PERMANENTLY_NOTIFIED_KEY, "false"); // Reset permanent notification flag

    Alert.alert(
      "Notification Reset",
      "The notification system has been reset. You will receive a new notification when you leave home."
    );
  };

  // Add useEffect to update distance from home whenever location or homeLocation changes
  useEffect(() => {
    if (location && homeLocation) {
      // Calculate the distance between current location and home
      const distance = calculateDistance(
        homeLocation.coords.latitude,
        homeLocation.coords.longitude,
        location.coords.latitude,
        location.coords.longitude
      );

      // Update the distance from home state
      setDistanceFromHome(distance);
      console.log(`Distance from home updated: ${distance.toFixed(2)}m`);

      // Check if we need to notify based on the new distance
      checkAndNotifyIfNeeded(distance).catch((err) =>
        console.error("Error checking notification status:", err)
      );
    }
  }, [location, homeLocation]);

  useEffect(() => {
    // Add initialization code to request permissions and get initial location
    (async () => {
      try {
        console.log("Requesting location permissions...");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg(
            "Location permission was denied. Please enable location services to use this app."
          );
          setIsLoading(false);
          return;
        }
        console.log("Location permissions granted!");

        // Request notification permissions
        const { status: notifStatus } =
          await Notifications.requestPermissionsAsync();
        if (notifStatus !== "granted") {
          console.log("Notification permissions not granted");
        } else {
          console.log("Notification permissions granted!");
        }

        // Get initial location with HIGHEST accuracy
        console.log("Getting initial location with highest accuracy...");
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        }).catch((error) => {
          console.error("Error getting initial location:", error);
          // Continue even if initial location fails
          return null;
        });

        if (initialLocation) {
          console.log("Initial location received:", initialLocation.coords);
          // Store initial location
          setLocation(initialLocation);
          lastLocation.current = initialLocation;

          // If home location isn't set yet, use this as default
          if (!homeLocation) {
            setHomeLocation(initialLocation);
            // Store home location in AsyncStorage
            try {
              await AsyncStorage.setItem(
                HOME_LOCATION_STORAGE_KEY,
                JSON.stringify({
                  coords: {
                    latitude: initialLocation.coords.latitude,
                    longitude: initialLocation.coords.longitude,
                    accuracy: initialLocation.coords.accuracy,
                  },
                })
              );
              console.log("Default home location saved to storage");
            } catch (e) {
              console.error("Error saving home location to storage:", e);
            }
          }
        } else {
          console.log(
            "No initial location received, will use location updates"
          );
        }

        // Always set loading to false, even if we couldn't get an initial location
        // The watchPositionAsync will provide location updates
        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing location:", error);
        setErrorMsg(
          `Error initializing location: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        setIsLoading(false);
      }
    })();
  }, []);

  // Add a new function to show the safety checklist
  const showSafetyChecklist = () => {
    Alert.alert(
      "Home Safety Checklist",
      "Before you leave, have you done the following?",
      [
        {
          text: "No, let me check",
          onPress: () => {
            console.log("User will check safety items");
            // Cancel notification and keep them in the safe zone
            resetNotificationStatus();
          },
          style: "cancel",
        },
        {
          text: "Yes, all done",
          onPress: () => {
            console.log("User confirmed safety checks");
            // Now show the destination dialog
            Alert.alert(
              "Where are you going?",
              `You've left your home area. Where are you headed?`,
              [
                {
                  text: "Just going for a walk",
                  onPress: () => {
                    console.log("User is just going for a walk");
                    setDestination("A walk");
                    AsyncStorage.setItem("last_destination", "A walk");
                  },
                },
                {
                  text: "Going somewhere",
                  onPress: () => askForDestination(),
                },
              ],
              { cancelable: false }
            );
          },
        },
      ],
      { cancelable: false }
    );

    // Display a more detailed checklist in a separate alert
    setTimeout(() => {
      Alert.alert(
        "Safety Checklist Details",
        "✅ Locked all doors?\n✅ Switched off all lights?\n✅ Turned off all fans?\n✅ Closed the gas supply?",
        [{ text: "I'll check these items" }],
        { cancelable: false }
      );
    }, 500);
  };

  // Add function to update threshold value
  const updateThresholdValue = async () => {
    showTextInputDialog(
      "Set Distance Threshold",
      `Enter the distance (in meters) at which you want to be notified when leaving home (current: ${thresholdValue}m):`,
      async (text) => {
        const newThreshold = parseInt(text, 10);
        if (!isNaN(newThreshold) && newThreshold > 0) {
          // Store the previous distance from home before updating the threshold
          const currentDistanceFromHome = distanceFromHome;

          // Update the threshold
          setThresholdValue(newThreshold);
          await AsyncStorage.setItem(
            THRESHOLD_VALUE_KEY,
            newThreshold.toString()
          );

          // Reset notification state, but with a specific logic:
          // Only if the new threshold would NOT immediately trigger a notification
          if (currentDistanceFromHome <= newThreshold) {
            // If user is within the new threshold, reset all notification flags
            notifiedAtTenMeters.current = false;
            firstTimeAboveThreshold.current = null;
            firstTimeBelowThreshold.current = null;
            lastNotificationTime.current = 0;

            // Reset all AsyncStorage notification flags
            await AsyncStorage.setItem(NOTIFIED_AT_TEN_METERS_KEY, "false");
            await AsyncStorage.setItem(LAST_NOTIFICATION_TIME_KEY, "0");
            await AsyncStorage.setItem(PERMANENTLY_NOTIFIED_KEY, "false");

            Alert.alert(
              "Threshold Updated",
              `Safety range set to ${newThreshold} meters. You will be notified when you leave this range.`
            );
          } else {
            // User is already outside the new threshold, don't reset notification flags
            Alert.alert(
              "Threshold Updated",
              `Safety range set to ${newThreshold} meters. Since you are already ${currentDistanceFromHome.toFixed(
                1
              )} meters from home, no new alerts will be sent until you return home and leave again.`
            );
          }
        } else {
          Alert.alert("Invalid Value", "Please enter a valid positive number.");
        }
      },
      thresholdValue.toString()
    );
  };

  // Add function to open Google Maps with directions to home
  const openGoogleMapsDirections = () => {
    if (!homeLocation) {
      Alert.alert("Home Not Set", "Please set your home location first.", [
        { text: "OK" },
      ]);
      return;
    }

    const { latitude, longitude } = homeLocation.coords;
    const label = "My Home";
    const url = Platform.select({
      ios: `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving&q=${label}`,
      android: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${label}`,
    });

    // Fallback URL if Google Maps app is not installed
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

    Linking.canOpenURL(url || webUrl)
      .then((supported) => {
        if (supported) {
          // Can open the Google Maps app URL
          Linking.openURL(url || webUrl);
        } else {
          // Google Maps app is not installed, open in browser
          Linking.openURL(webUrl);
        }
      })
      .catch((err) => {
        console.error("Error opening map:", err);
        // Fallback to browser version
        Linking.openURL(webUrl);
      });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.loadingText}>Getting location...</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>
            Getting location...
          </ThemedText>
        </View>
      ) : errorMsg ? (
        <ThemedText style={styles.error}>{errorMsg}</ThemedText>
      ) : (
        <View style={styles.scrollContainer}>
          {/* Home Zone Card - Most important card */}
          <View style={[styles.card, styles.primaryCard]}>
            <ThemedText style={styles.title}>Home Location</ThemedText>
            {homeLocation ? (
              <>
                <View style={styles.distanceIndicator}>
                  <View style={styles.distanceBadge}>
                    <ThemedText style={styles.largeDistanceValue}>
                      {distanceFromHome.toFixed(1)}
                    </ThemedText>
                    <ThemedText style={styles.distanceUnit}>meters</ThemedText>
                  </View>
                </View>

                <ThemedText
                  style={[
                    styles.homeZoneStatus,
                    distanceFromHome <= thresholdValue
                      ? styles.insideHomeStatus
                      : styles.outsideHomeStatus,
                  ]}
                >
                  {distanceFromHome <= thresholdValue
                    ? "✅ Inside Home"
                    : "⚠️ Outside Home"}
                </ThemedText>

                <ThemedText style={styles.thresholdText}>
                  Safety threshold: {thresholdValue} meters
                </ThemedText>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: "#4CAF50" }]}
                  onPress={setCurrentLocationAsHome}
                >
                  <ThemedText style={styles.buttonText}>
                    Set Current as Home
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    { backgroundColor: "#3F51B5", marginTop: 10 },
                  ]}
                  onPress={openGoogleMapsDirections}
                >
                  <ThemedText style={styles.buttonText}>
                    Directions to Home
                  </ThemedText>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.noHomeContainer}>
                  <ThemedText style={styles.noHomeText}>
                    Home location not set
                  </ThemedText>
                  <ThemedText style={styles.noHomeSubtext}>
                    Please set your current location as home to enable safety
                    alerts
                  </ThemedText>
                </View>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: "#4CAF50" }]}
                  onPress={setCurrentLocationAsHome}
                >
                  <ThemedText style={styles.buttonText}>
                    Set Current as Home
                  </ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>

          {destination && (
            <View style={[styles.card, styles.destinationCard]}>
              <ThemedText style={styles.title}>Destination</ThemedText>
              <ThemedText>You are going to: {destination}</ThemedText>
            </View>
          )}

          {/* Notification Status Card - Simplified */}
          <View style={styles.card}>
            <ThemedText style={styles.title}>Safety Settings</ThemedText>

            <View style={styles.safetyInfoContainer}>
              <ThemedText style={styles.safetyInfoLabel}>
                Alert Status:
              </ThemedText>
              <ThemedText
                style={[
                  styles.safetyInfoValue,
                  notifiedAtTenMeters.current
                    ? styles.alertSent
                    : styles.alertPending,
                ]}
              >
                {notifiedAtTenMeters.current
                  ? "Already Notified"
                  : "Will Alert When You Leave Home"}
              </ThemedText>
            </View>

            <View style={styles.safetyInfoContainer}>
              <ThemedText style={styles.safetyInfoLabel}>
                Safety Range:
              </ThemedText>
              <ThemedText style={styles.safetyInfoValue}>
                {thresholdValue} meters from home
              </ThemedText>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: "#007AFF", marginTop: 15 },
              ]}
              onPress={updateThresholdValue}
            >
              <ThemedText style={styles.buttonText}>
                Change Safety Range
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Add modal for text input dialog (Android) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          modalCallback("");
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <ThemedText style={styles.modalTitle}>{modalTitle}</ThemedText>
            <ThemedText style={styles.modalMessage}>{modalMessage}</ThemedText>

            <TextInput
              style={styles.textInput}
              onChangeText={setModalText}
              value={modalText}
              placeholder="Enter text here"
              placeholderTextColor="#777"
              autoFocus={true}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.buttonCancel]}
                onPress={() => {
                  setModalVisible(false);
                  modalCallback("");
                }}
              >
                <ThemedText style={styles.buttonTextDark}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.buttonConfirm]}
                onPress={() => {
                  setModalVisible(false);
                  modalCallback(modalText);
                }}
              >
                <ThemedText style={styles.buttonTextLight}>OK</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#121212",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
    minHeight: 300,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#eee",
  },
  card: {
    backgroundColor: "#1A1A1A",
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  statusCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  primaryCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
    backgroundColor: "#1E293B",
  },
  destinationCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#fff",
    textAlign: "center",
  },
  error: {
    color: "#FF453A",
    textAlign: "center",
    marginTop: 20,
    padding: 16,
    backgroundColor: "rgba(255, 69, 58, 0.1)",
    borderRadius: 12,
  },
  status: {
    marginTop: 8,
    color: "#4CAF50",
    fontWeight: "bold",
  },
  moving: {
    color: "#FF9500",
  },
  largeDistanceValue: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#007AFF",
    marginTop: 10,
    marginBottom: 10,
    textAlign: "center",
  },
  homeZoneStatus: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 4,
    marginBottom: 16,
    color: "#eee",
    textAlign: "center",
  },
  speedText: {
    marginTop: 4,
    fontWeight: "bold",
    color: "#eee",
  },
  notificationStatus: {
    marginTop: 4,
    fontWeight: "bold",
    color: "#eee",
  },
  enabled: {
    color: "#4CAF50",
  },
  disabled: {
    color: "#FF453A",
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 10,
  },
  warningText: {
    color: "#FF9500",
    fontSize: 14,
    marginBottom: 5,
  },
  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 5,
  },
  distanceContainer: {
    flex: 1,
  },
  distanceLabel: {
    color: "#aaa",
    fontSize: 14,
  },
  distanceValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007AFF",
  },
  autoUpdateText: {
    fontSize: 10,
    color: "#888",
    fontStyle: "italic",
  },
  backgroundStatus: {
    marginTop: 4,
    fontWeight: "bold",
    color: "#eee",
  },
  warningContainer: {
    backgroundColor: "rgba(255, 149, 0, 0.1)",
    borderColor: "rgba(255, 149, 0, 0.3)",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  warningNote: {
    color: "#FF9500",
    fontSize: 12,
    fontStyle: "italic",
  },
  accuracyText: {
    color: "#007AFF",
    fontWeight: "bold",
    marginVertical: 2,
  },
  statusText: {
    fontSize: 14,
    marginVertical: 3,
    color: "#eee",
  },
  statusValue: {
    fontWeight: "bold",
    color: "#fff",
  },
  distanceText: {
    fontSize: 16,
    marginVertical: 5,
    color: "#eee",
  },
  movementDetails: {
    fontSize: 14,
    color: "#aaa",
    marginVertical: 2,
  },
  thresholdStatus: {
    fontSize: 14,
    fontWeight: "bold",
    marginVertical: 5,
    color: "#eee",
  },
  button: {
    backgroundColor: "#333",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 8,
    minWidth: "80%",
    alignSelf: "center",
  },
  buttonText: {
    fontWeight: "bold",
    color: "#fff",
    fontSize: 16,
  },
  activeButton: {
    backgroundColor: "#007AFF",
  },
  hint: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 5,
    fontStyle: "italic",
  },
  // Modal styles for Android text input
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalView: {
    width: "85%",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#333",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#fff",
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 15,
    color: "#eee",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
    color: "#eee",
    backgroundColor: "#222",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginLeft: 10,
  },
  buttonCancel: {
    backgroundColor: "#444",
  },
  buttonConfirm: {
    backgroundColor: "#007AFF",
  },
  buttonTextLight: {
    color: "white",
    fontWeight: "bold",
  },
  buttonTextDark: {
    color: "#fff",
    fontWeight: "bold",
  },
  thresholdText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FF9500",
    textAlign: "center",
    marginBottom: 16,
  },
  safetyInfoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  safetyInfoLabel: {
    fontSize: 16,
    color: "#aaa",
  },
  safetyInfoValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  alertSent: {
    color: "#FF9500",
  },
  alertPending: {
    color: "#4CAF50",
  },
  distanceIndicator: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  distanceBadge: {
    backgroundColor: "rgba(0, 122, 255, 0.15)",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderWidth: 1,
    borderColor: "rgba(0, 122, 255, 0.3)",
  },
  distanceUnit: {
    color: "#999",
    fontSize: 16,
    textAlign: "center",
    marginTop: -5,
  },
  insideHomeStatus: {
    color: "#4CAF50",
  },
  outsideHomeStatus: {
    color: "#FF9500",
  },
  noHomeContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 30,
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
  },
  noHomeText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FF9500",
    marginBottom: 10,
  },
  noHomeSubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
});
