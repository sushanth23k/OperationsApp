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

/**
 * TestScreen component for handling speech recognition
 * @param navigation - Navigation prop for screen navigation
 */
const TestScreen = ({ navigation }: { navigation: any }) => {
  console.log('Initializing TestScreen component');
  
  const [recognizing, setRecognizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [response, setResponse] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptRef = useRef('');
  const startRequestRef = useRef<boolean>(false);
  const [hasPermission, setHasPermission] = useState(false);
  const ws = useRef<globalThis.WebSocket | null>(null);
  const conversationId = useRef(Date.now().toString());

  // Set up speech recognition event handlers
  useSpeechRecognitionEvent("start", () => {
    console.log('Speech recognition started');
    setRecognizing(true);
    setIsStarting(false);
    startRequestRef.current = false;
  });
  
  useSpeechRecognitionEvent("end", () => {
    console.log('Speech recognition ended');
    setRecognizing(false);
    // Clear any pending timeouts to prevent sending messages after recognition ends
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  });
  
  useSpeechRecognitionEvent("result", async (event) => {
    console.log('Received speech recognition result');
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
        console.log('Processing final transcript:', newTranscript);
        stopRecording();
        // Send message through WebSocket instead of ConversationManager
        try {
          if (ws.current?.readyState === WebSocket.OPEN) {
            const payload = {
              message: newTranscript,
              conversationId: conversationId.current,
            };
            console.log('Sending message to WebSocket:', payload);
            ws.current.send(JSON.stringify(payload));
          } else {
            throw new Error('WebSocket is not connected');
          }
        } catch (error) {
          console.error('Error sending message:', error);
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
    console.log("Speech recognition error - code:", event.error, "message:", event.message);
    setIsStarting(false);
    startRequestRef.current = false;
  });

  // Add permission check in useEffect
  useEffect(() => {
    console.log('Running TestScreen useEffect');
    
    const checkPermissions = async () => {
      console.log('Checking speech recognition permissions');
      try {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        setHasPermission(result.granted);
        if (!result.granted) {
          console.warn("Speech recognition permissions not granted");
        } else {
          console.log('Speech recognition permissions granted');
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        setHasPermission(false);
      }
    };

    checkPermissions();
    
    // Initialize WebSocket connection
    console.log('Initializing WebSocket connection');
    ws.current = new WebSocket('ws://localhost:8000/ws');

    ws.current.onopen = () => {
      console.log('WebSocket Connected successfully');
    };

    ws.current.onmessage = (event: MessageEvent) => {
      console.log('Received WebSocket message:', event.data);
      try {
        const response = JSON.parse(event.data);
        console.log('Parsed response:', response);
        if (response.message) {
          setResponse(response.message);
          // Speak the AI response
          console.log('Speaking AI response:', response.message);
          Speech.speak(response.message, {
            language: 'en',
            pitch: 1.0,
            rate: 0.9
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.current.onerror = (event: Event) => {
      console.error('WebSocket error:', event);
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      ws.current = null;
    };

    return () => {
      console.log('Cleaning up TestScreen component');
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      Speech.stop();
    };
  }, []);

  const startRecording = async () => {
    console.log('Starting speech recording');
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
      console.log('Initializing speech recognition with settings');
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
      console.log('Speech recognition started successfully');

    } catch (error) {
      console.error('Error starting recording:', error);
      setRecognizing(false);
      setIsStarting(false);
      startRequestRef.current = false;
    }
  };

  const stopRecording = async () => {
    console.log('Stopping speech recording');
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      await ExpoSpeechRecognitionModule.stop();
      console.log('Speech recording stopped successfully');
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