import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  FlatList,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { createClient, LiveTranscriptionEvents, ListenLiveClient } from "@deepgram/sdk";
import { Audio } from 'expo-av';

const TalkScreen = ({ navigation }: { navigation: any }) => {
  console.log("TalkScreen");
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      text: 'Hi, Welcome to Operations. What can I help you with'
    }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [connection, setConnection] = useState<ListenLiveClient | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [tasks, setTasks] = useState([
    { id: '1', title: 'Complete project report', status: 'pending' },
    { id: '2', title: 'Schedule team meeting', status: 'completed' },
    { id: '3', title: 'Review documentation', status: 'pending' }
  ]);
  console.log("TalkScreen1");
  const requestMicrophonePermission = async () => {
    try {
      return true; // iOS handles permissions through Info.plist
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  };
  console.log("TalkScreen2");
  useEffect(() => {
    let isMounted = true;
    console.log("TalkScreen3");
    const initializeAudioAndDeepgram = async () => {
      try {
        // Request microphone permission
        console.log("TalkScreen4");
        const permission = await requestMicrophonePermission();
        if (!isMounted) return;
        setHasPermission(permission);
        console.log("TalkScreen5");
        if (permission) {
          try {
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: true,
              playsInSilentModeIOS: true,
            });
          } catch (audioError) {
            console.error('Error setting up audio:', audioError);
            return;
          }
          console.log("TalkScreen6");
          try {
            // Initialize Deepgram client
            const deepgram = createClient("ff0c5d0265dd3363bda860a2b13355672d84ad5e");
            console.log("TalkScreen7");
            // Create live transcription connection
            const dgConnection = deepgram.listen.live({
              model: "nova-2",
              language: "en-US",
              smart_format: true,
              encoding: "linear16",
              sample_rate: 16000,
            });
            console.log("TalkScreen8");
            if (!isMounted) {
              dgConnection.finish();
              return;
            }
            console.log("TalkScreen9");
            setConnection(dgConnection);

            // Set up Deepgram event listeners
            dgConnection.on(LiveTranscriptionEvents.Open, () => {
              if (!isMounted) return;
              console.log("Connection opened");
            });
            console.log("TalkScreen10");

            dgConnection.on(LiveTranscriptionEvents.Close, () => {
              if (!isMounted) return;
              console.log("Connection closed");
              setIsListening(false);
            });

            dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
              if (!isMounted) return;
              const transcript = data?.channel?.alternatives?.[0]?.transcript;
              if (transcript) {
                setCurrentTranscript(transcript);
                setMessages(prev => [...prev, {
                  type: 'user',
                  text: transcript
                }]);
              }
            });

            dgConnection.on(LiveTranscriptionEvents.Error, (err) => {
              if (!isMounted) return;
              console.error('Deepgram transcription error:', err);
              setIsListening(false);
            });
          } catch (deepgramError) {
            console.error('Error initializing Deepgram:', deepgramError);
          }
        }
      } catch (error) {
        console.error('Error in initializeAudioAndDeepgram:', error);
      }
    };

    initializeAudioAndDeepgram().catch(error => {
      console.error('Unhandled error in initialization:', error);
    });

    return () => {
      isMounted = false;
      if (recording) {
        recording.stopAndUnloadAsync().catch(error => {
          console.error('Error stopping recording in cleanup:', error);
        });
      }
      if (connection) {
        try {
          connection.finish();
        } catch (error) {
          console.error('Error finishing connection in cleanup:', error);
        }
      }
    };
  }, []);

  const startListening = async () => {
    try {
      if (!connection) return;

      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        async (status) => {
          try {
            if (status.isRecording && connection && status.durationMillis > 0) {
              const uri = newRecording.getURI();
              if (uri) {
                const response = await fetch(uri);
                const audioData = await response.arrayBuffer();
                connection.send(new Uint8Array(audioData));
              }
            }
          } catch (error) {
            console.error('Error in recording callback:', error);
          }
        },
        100 // Update interval in milliseconds
      );
      
      setRecording(newRecording);
      setIsListening(true);
    } catch (error) {
      console.error('Error starting transcription:', error);
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }
      setIsListening(false);
    } catch (error) {
      console.error('Error stopping transcription:', error);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const clearMessages = () => {
    setMessages([{
      type: 'bot',
      text: 'Hi, Welcome to Operations. What can I help you with'
    }]);
  };

  const renderTask = ({ item }: { item: any }) => (
    <View style={styles.taskItem}>
      <View style={styles.taskContent}>
        <Text style={styles.taskTitle}>{item.title}</Text>
        <Text style={[
          styles.taskStatus,
          item.status === 'completed' ? styles.statusCompleted : styles.statusPending
        ]}>
          {item.status}
        </Text>
      </View>
      <TouchableOpacity style={styles.taskAction}>
        <Icon name="more-vert" size={20} color="#666" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.backButtonText}>← Back to Home</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.imageContainer}>
        <Image
          source={require("../../src/constants/images/image.png")}
          style={styles.image}
          resizeMode="contain"
        />
      </View>

      <ScrollView style={styles.chatContainer}>
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageContainer,
              message.type === 'bot' ? styles.botMessage : styles.userMessage
            ]}
          >
            <Text style={styles.messageText}>{message.text}</Text>
          </View>
        ))}
        {currentTranscript ? (
          <View style={[styles.messageContainer, styles.userMessage, styles.transcriptMessage]}>
            <Text style={styles.messageText}>{currentTranscript}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.tasksSection}>
        <Text style={styles.tasksSectionTitle}>Current Tasks</Text>
        <FlatList
          data={tasks}
          renderItem={renderTask}
          keyExtractor={item => item.id}
          style={styles.tasksList}
          scrollEnabled={true}
        />
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.sideButtonContainer}>
          <TouchableOpacity
            style={[styles.controlButton, styles.stopButton]}
            onPress={stopListening}
          >
            <Icon name="stop" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.buttonText}>Stop</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.controlButton, 
            styles.voiceButton,
            !hasPermission && styles.disabledButton
          ]}
          onPress={toggleListening}
          disabled={!hasPermission}
        >
          <Icon
            name={isListening ? 'mic' : 'mic-none'}
            size={32}
            color="white"
          />
        </TouchableOpacity>

        <View style={styles.sideButtonContainer}>
          <TouchableOpacity
            style={[styles.controlButton, styles.clearButton]}
            onPress={clearMessages}
          >
            <Icon name="clear-all" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.buttonText}>Clear</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  disabledButton: {
    opacity: 0.5,
  },
  header: {
    backgroundColor: 'white',
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginBottom: 5,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  imageContainer: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  image: {
    width: '40%',
    height: '100%',
  },
  chatContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fafafa',
  },
  tasksSection: {
    backgroundColor: 'white',
    paddingVertical: 8,
    maxHeight: 160,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  tasksSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 16,
    marginBottom: 8,
    color: '#333',
  },
  tasksList: {
    maxHeight: 120,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  taskStatus: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  statusPending: {
    color: '#FFA000',
  },
  statusCompleted: {
    color: '#4CAF50',
  },
  taskAction: {
    padding: 4,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  botMessage: {
    backgroundColor: '#E3F2FD',
    alignSelf: 'flex-start',
  },
  userMessage: {
    backgroundColor: '#E8F5E9',
    alignSelf: 'flex-end',
  },
  transcriptMessage: {
    backgroundColor: '#E0E0E0',
    opacity: 0.8,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  sideButtonContainer: {
    alignItems: 'center',
  },
  controlButton: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 32,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  voiceButton: {
    width: 64,
    height: 64,
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    width: 48,
    height: 48,
    backgroundColor: '#f44336',
  },
  clearButton: {
    width: 48,
    height: 48,
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
});

export default TalkScreen;