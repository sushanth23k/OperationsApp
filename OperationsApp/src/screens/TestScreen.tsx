import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import EventEmitter from 'events';
import useWebSocket from 'react-native-use-websocket';
import { Audio } from 'expo-av';
import { CustomLiveClient, LiveTranscriptionEvents, LiveConnectionState } from '../components/DPWebSocket';
import { Ionicons } from '@expo/vector-icons';

/**
 * TestScreen component for handling audio recording and real-time transcription
 * @param navigation - Navigation prop for screen navigation
 */
const TestScreen = ({ navigation }: { navigation: any }) => {
  // State variables for managing component state
  const [isMounted, setIsMounted] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [dgConnection, setDgConnection] = useState<CustomLiveClient | null>(null);

  const [wait, setWait] = useState(0);
  const waitRef = useRef(0);
  const combinedAudioRef = useRef<Uint8Array[]>([]);
  const isProcessingRef = useRef(false);
  const startConvert = useRef(0);
  const startConvertRef = useRef(false);

  // Deepgram API configuration
  const baseUrl = 'wss://api.deepgram.com/v1/listen';
  // WARNING: API key should not be exposed in the code. Move to environment variables
  const API_KEY = "1a64aafc69cf8dc4df961044fe8066f2d625ce2e";
  
  // Configuration options for the transcription service
  const transcriptionOptions = {
    model: "nova",
    punctuate: true,
    interim_results: true,
    encoding: "linear16",
    sample_rate: 44100
  };

  // Create WebSocket URL with configuration options
  const url = new URL('v1/listen', 'wss://api.deepgram.com');
  url.protocol = url.protocol.toLowerCase().replace(/(http)(s)?/gi, 'ws$2');

  Object.entries(transcriptionOptions).forEach(([key, value]) => {
    url.searchParams.append(key, String(value));
  });
    
  // Initialize WebSocket connection with authentication
  const { getWebSocket } = useWebSocket(url.toString(), {
    options: {
      headers: {
        Authorization: 'Token ' + API_KEY
      }
    },
    shouldReconnect: () => false,
    reconnectAttempts: 5,
    reconnectInterval: 3000,
  });

  const processAndSendCombinedAudio = async () => {
    if (isProcessingRef.current || combinedAudioRef.current.length === 0) return;
    
    isProcessingRef.current = true;
    const combinedAudio = new Uint8Array(
      combinedAudioRef.current.reduce((acc, curr) => acc + curr.length, 0)
    );
    
    let offset = 0;
    combinedAudioRef.current.forEach(chunk => {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    });

    try {
      if (dgConnection && dgConnection._socket.readyState === LiveConnectionState.OPEN) {
        dgConnection.send(combinedAudio);
      }
    } catch (error) {
      console.error("Error sending combined audio:", error);
    }

    combinedAudioRef.current = [];
    isProcessingRef.current = false;
  };

  const calculateDB = (audioData: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);
    return 20 * Math.log10(rms);
  };

  const recordAndAnalyzeChunk = async () => {
    console.log("recordAndAnalyzeChunk called");
    if (isRecording) return;
    const { recording: newRecording } = await Audio.Recording.createAsync({
        ios: {
          extension: '.wav',
          outputFormat: 'lpcm',
          audioQuality: 0x7a,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        android: {
          extension: '.wav',
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        }
      });

    
    try {
      console.log("Recording chunk...");
      await newRecording.startAsync();
      await new Promise(resolve => setTimeout(resolve, 250));
      await newRecording.stopAndUnloadAsync();
      console.log("Recording chunk stopped");

      const uri = newRecording.getURI();
      if (uri) {
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        // Create Int16Array from the raw buffer to properly handle 16-bit PCM data
        const int16Data = new Int16Array(arrayBuffer);
        // Convert to float32 for dB calculation
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / 32768.0;
        }
        const dB = calculateDB(float32Data);
        
        console.log("Audio level:", dB, "dB");
        console.log("Count and start convert:", startConvert.current, "Start convert:", startConvertRef.current);
        if (startConvert.current>=5 && startConvertRef.current== true) {
            console.log("Conversaion ended");
            stopRecording();
            return;
        }

        if (dB <= -30.0) {
          console.log("Sending combined audio");
          startConvert.current = startConvert.current + 1;
          await processAndSendCombinedAudio();
        } else {
          console.log("Adding to combined audio");
          startConvertRef.current = true;
          startConvert.current = 0;
          combinedAudioRef.current.push(new Uint8Array(arrayBuffer));
        }
        console.log("isRecording:", isRecording);
        // Start next recording chunk
        if (!isRecording) {
          recordAndAnalyzeChunk();
        }
      }
    } catch (error) {
      console.error("Error recording chunk:", error);
      if (isRecording) {
        recordAndAnalyzeChunk();
      }
    }
  };

  const initializeAudioAndWebSocket = async (mounted: boolean) => {
    try {
      console.log("Requesting audio permissions...");
      await Audio.requestPermissionsAsync();
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const ws = getWebSocket();
      if (ws && mounted) {
        console.log("Creating new WebSocket connection");
        const newConnection = new CustomLiveClient(ws);
        
        newConnection.on(LiveTranscriptionEvents.Open, () => {
          console.log('Connection opened');
          console.log("Connection state:", newConnection._socket.readyState);
        });
   
        newConnection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
          if (newConnection._socket.readyState === LiveConnectionState.OPEN) {
            console.log("Connection state:", newConnection._socket.readyState);
            if (data.is_final) {
              setLiveText(prev => prev + ' ' + data.channel.alternatives[0].transcript);
              console.log("Final transcript:", data.channel.alternatives[0].transcript);
            } else {
              setLiveText(prev => prev + ' ' + data.channel.alternatives[0].transcript);
              console.log("Interim transcript:", data.channel.alternatives[0].transcript);
            }
          }
        });
  
        newConnection.on(LiveTranscriptionEvents.Error, (error: any) => {
          console.error('Transcription error:', error);
          setIsRecording(false);
        });
    
        newConnection.on(LiveTranscriptionEvents.Close, () => {
          console.log('Connection closed');
          console.log("Connection state:", newConnection._socket.readyState);
          setIsRecording(false);
        });

        setDgConnection(newConnection);
      }
    } catch (error) {
      console.error("Error during initialization:", error);
    }
  };

 useEffect(() => {
    let mounted = true;

    initializeAudioAndWebSocket(mounted);
    
    return () => {
      mounted = false;
      setIsMounted(false);
      if (dgConnection) {
        dgConnection.removeAllListeners();
        dgConnection.finish();
      }
      if (recording) {
        recording.stopAndUnloadAsync();
        setRecording(null);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!dgConnection) {
        console.error('WebSocket connection not initialized');
        return;
      }
      setIsRecording(true);
      startConvert.current = 0;
      startConvertRef.current = false;

      waitRef.current = 0;
      setWait(0);
      console.log("Starting recording...");
     
      combinedAudioRef.current = [];
      isProcessingRef.current = false;
      recordAndAnalyzeChunk();

    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      console.log("Stopping recording...");
      waitRef.current = 0;
      setWait(0);
     
      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }
      
      await processAndSendCombinedAudio();
      
      if (dgConnection) {
        dgConnection.finish();
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
    }
  };

  // Render the UI components
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.button, isRecording && styles.recordingButton]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.buttonText}>
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Text>
        </TouchableOpacity>

        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptLabel}>Transcript:</Text>
          {liveText !== '' ? (
            <Text style={styles.liveText}>{liveText}</Text>
          ) : ''}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  backButton: {
    padding: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center', 
    padding: 20,
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
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  transcriptContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    width: '90%',
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
});

export default TestScreen;