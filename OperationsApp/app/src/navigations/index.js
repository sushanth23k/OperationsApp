import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../screens/WelcomeScreen';
import HomeScreen from '../screens/HomeScreen';
import TasksScreen from '../screens/TasksScreen';
import TalkScreen from '../screens/TalkScreen';
import TestScreen from '../screens/TestScreen';
import TestScreen1 from '../screens/TestScreen1';

const Stack = createNativeStackNavigator();

export default function AppNavigation() {
  return (
    <Stack.Navigator 
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Tasks" component={TasksScreen} />
      <Stack.Screen name="Talk" component={TalkScreen} />
      <Stack.Screen name="Test" component={TestScreen} />
      <Stack.Screen name="Test1" component={TestScreen1} />
    </Stack.Navigator>
  );
}