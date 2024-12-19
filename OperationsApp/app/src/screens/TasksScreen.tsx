import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const TasksScreen = ({ navigation }: { navigation: any }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.backButtonText}>← Back to Home</Text>
      </TouchableOpacity>
      <Text style={styles.text}>Tasks Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  backButton: {
    marginTop: 40,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4CAF50',
  },
  text: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
  },
});

export default TasksScreen;