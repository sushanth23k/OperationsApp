import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        // Configure tab bar styling here
        tabBarActiveTintColor: colorScheme === 'dark' ? '#fff' : '#000',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          // Add tab icon here if needed
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          // Add tab icon here if needed
        }}
      />
    </Tabs>
  );
}