import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import * as Speech from 'expo-speech';
import ConversationManager from './Conversarion';

/**
 * TestScreen component for handling speech recognition
 * @param navigation - Navigation prop for screen navigation
 */
const TestScreen = ({ navigation }: { navigation: any }) => {
  const [recognizing, setRecognizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [response, setResponse] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptRef = useRef('');
  const startRequestRef = useRef<boolean>(false);
  const [hasPermission, setHasPermission] = useState(false);
  const conversationManager = useRef(new ConversationManager());

  // Set up speech recognition event handlers
  useSpeechRecognitionEvent("start", () => {
    setRecognizing(true);
    setIsStarting(false);
    startRequestRef.current = false;
  });
  
  useSpeechRecognitionEvent("end", () => setRecognizing(false));
  
  useSpeechRecognitionEvent("result", async (event) => {
    const newTranscript = event.results[0]?.transcript;
    setTranscript(newTranscript);
    lastTranscriptRef.current = newTranscript;
    
    // Reset timeout when new text arrives
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout
    timeoutRef.current = setTimeout(async () => {
      if (recognizing && lastTranscriptRef.current === newTranscript) {
        stopRecording();
        // Get response from conversation manager
        try {
          const aiResponse = await conversationManager.current.sendMessage(newTranscript);
          setResponse(aiResponse);
          // Speak the AI response
          await Speech.speak(aiResponse, {
            language: 'en',
            pitch: 1.0,
            rate: 0.9
          });
        } catch (error) {
          console.error('Error getting AI response:', error);
          setResponse('Sorry, I had trouble processing that request.');
          await Speech.speak('Sorry, I had trouble processing that request.', {
            language: 'en',
            pitch: 1.0,
            rate: 0.9
          });
        }
      }
    }, 3000);
  });
  
  useSpeechRecognitionEvent("error", (event) => {
    console.log("error code:", event.error, "error message:", event.message);
    setIsStarting(false);
    startRequestRef.current = false;
  });

  // Add permission check in useEffect
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        setHasPermission(result.granted);
        if (!result.granted) {
          console.warn("Speech recognition permissions not granted");
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        setHasPermission(false);
      }
    };

    checkPermissions();
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Stop any ongoing speech when component unmounts
      Speech.stop();
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!hasPermission) {
        console.warn("Permissions not granted");
        return;
      }

      // Prevent multiple simultaneous start requests
      if (startRequestRef.current) {
        console.log('Start request already in progress');
        return;
      }

      startRequestRef.current = true;
      setIsStarting(true);

      // Start speech recognition
      await ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
        volumeChangeEventOptions: {
          enabled: true,
          intervalMillis: 300,
        }
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      setRecognizing(false);
      setIsStarting(false);
      startRequestRef.current = false;
    }
  };

  const stopRecording = async () => {
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      await ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      console.error("Error stopping recording:", error);
    }
  };

  // Render the UI components
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button, 
            recognizing && styles.recordingButton,
            isStarting && styles.disabledButton
          ]}
          disabled={isStarting}
          onPress={recognizing ? stopRecording : startRecording}
        >
          <Text style={styles.buttonText}>
            {isStarting ? 'Starting...' : recognizing ? 'Stop Recording' : 'Start Recording'}
          </Text>
        </TouchableOpacity>

        <View style={styles.displayRow}>
          <View style={styles.transcriptContainer}>
            <Text style={styles.transcriptLabel}>Input:</Text>
            {transcript !== '' && (
              <Text style={styles.liveText}>{transcript}</Text>
            )}
          </View>

          <View style={styles.textDisplayContainer}>
            <Text style={styles.textDisplayLabel}>Response:</Text>
            <Text style={styles.textDisplayContent}>
              {response || 'Waiting for input...'}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

// Styles for the UI components
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center', 
    padding: 20,
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    padding: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: '#f44336',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  displayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  transcriptContainer: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    width: '48%',
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  transcriptLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  transcriptText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  liveText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  textDisplayContainer: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    width: '48%',
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  textDisplayLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  textDisplayContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default TestScreen;