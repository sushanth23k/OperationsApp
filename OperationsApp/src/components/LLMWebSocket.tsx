import React, { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';

interface Task {
  taskId: number;
  description: string;
  points: number | null;
  items: string[] | null;
  time: string | null;
  location: string | null;
  status: string;
}

interface WebSocketResponse {
  message: string;
  tasks: Task[] | [];
}

interface WebSocketMessage {
  message: string;
  conversationId: string;
}

const LLMWebSocket = () => {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    ws.current = new WebSocket('ws://localhost:8000/ws');

    // Connection opened
    ws.current.onopen = () => {
      console.log('WebSocket Connected');
    };

    // Listen for messages
    ws.current.onmessage = (event) => {
      try {
        const response: WebSocketResponse = JSON.parse(event.data);
        console.log('Received:', response);
        // Handle the response here
        if (response.tasks && response.tasks.length > 0) {
          // Process tasks
          console.log('Received tasks:', response.tasks);
        } else {
          console.log('No tasks received');
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // Handle errors
    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Handle connection close
    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
    };

    // Cleanup on component unmount
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const sendMessage = (message: string, conversationId: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const payload: WebSocketMessage = {
        message,
        conversationId,
      };
      ws.current.send(JSON.stringify(payload));
    } else {
      console.error('WebSocket is not connected');
    }
  };

  return (
    <View>
      <Text>WebSocket Component</Text>
    </View>
  );
};

export default LLMWebSocket;

