import { StyleSheet, Text, View, Image, Alert, Platform } from "react-native";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
  PhotoFile,
  useCameraPermission,
} from "react-native-vision-camera";
import {
  Face,
  useFaceDetector,
  FaceDetectionOptions,
} from "react-native-vision-camera-face-detector";
import { Worklets } from "react-native-worklets-core";

export default function HomeScreen() {
  // Add at the top of your component
  const [isOldAndroid, setIsOldAndroid] = useState(false);

  useEffect(() => {
    if (Platform.OS === "android" && Platform.Version < 23) {
      setIsOldAndroid(true);
    }
  }, []);

  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: "accurate",
    landmarkMode: "all",
    contourMode: "none",
    classificationMode: "all",
    minFaceSize: 0.15,
  }).current;

  const { hasPermission, requestPermission } = useCameraPermission();
  const [lastBlinkTime, setLastBlinkTime] = useState(0);
  const [capturedPhoto, setCapturedPhoto] = useState<PhotoFile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const camera = useRef<Camera>(null);
  const device = useCameraDevice("front");
  const { detectFaces } = useFaceDetector(faceDetectionOptions);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          Alert.alert("Permission required", "Camera permission is needed");
          return;
        }
      }
      setIsCameraReady(true);
    };
    checkPermissions();
  }, [hasPermission, requestPermission]);

  const capturePhoto = useCallback(async () => {
    console.log("capturePhoto function called");
    try {
      if (!camera.current) {
        console.log("Camera ref is null");
        return;
      }

      console.log("Taking photo...");
      const photo = await camera.current.takePhoto({
        flash: "off",
        qualityPrioritization: "quality",
        skipMetadata: true,
      });
      console.log("Photo captured successfully");
      setCapturedPhoto(photo);
      setShowPreview(true);
    } catch (error) {
      // console.error("Photo capture error:", error);
    }
  }, []);

  const handleDetectedFaces = Worklets.createRunOnJS((faces: Face[]) => {
    const now = Date.now();
    faces.forEach((face) => {
      if (
        face.leftEyeOpenProbability !== undefined &&
        face.rightEyeOpenProbability !== undefined
      ) {
        const leftEyeClosed = face.leftEyeOpenProbability < 0.4;
        const rightEyeClosed = face.rightEyeOpenProbability < 0.4;

        if (leftEyeClosed && rightEyeClosed && now - lastBlinkTime > 500) {
          console.log("Blink detected - calling capturePhoto");
          setLastBlinkTime(now);
          capturePhoto();
        }
      }
    });
  });

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      const faces = detectFaces(frame);
      handleDetectedFaces(faces);
    },
    [handleDetectedFaces, lastBlinkTime, capturePhoto]
  );

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text>Camera permission not granted</Text>
      </View>
    );
  }

  if (showPreview && capturedPhoto) {
    return (
      <View style={{ flex: 1 }}>
        <Image
          source={{ uri: `file://${capturedPhoto.path}` }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <Text style={styles.closeButton} onPress={() => setShowPreview(false)}>
          Close Preview
        </Text>
      </View>
    );
  }

  if (isOldAndroid) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>This feature requires Android 6.0 or newer</Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      {!!device && isCameraReady ? (
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={!showPreview}
          frameProcessor={frameProcessor}
          pixelFormat="yuv"
          photo={true}
          onInitialized={() => console.log("Camera initialized successfully")}
          onError={(error) => console.error("Camera error:", error)}
        />
      ) : (
        <Text>Camera not ready</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "white",
    padding: 10,
    borderRadius: 5,
    zIndex: 1,
  },
});
