import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Navigators & Screens
import BottomTabs from './BottomTabs';
import LoginScreen from '../screens/auth/LoginScreen';
import MemberDetailScreen from '../screens/members/MemberDetailScreen';
import StatementScreen from '../screens/statement/StatementScreen';

const Stack = createNativeStackNavigator();

const prefix = Linking.createURL('/');

const linking = {
  prefixes: [prefix, 'localsaas://', 'https://app.example.com'],
  config: {
    screens: {
      Statement: 's/:token',
      Main: {
        screens: {
          Dashboard: '',
          Members: 'members',
          Reports: 'reports',
          Setup: 'setup',
          Settings: 'settings',
        },
      },
      MemberDetail: 'members/:id',
    },
  },
};

export default function AppNavigator() {
  const { token, isLoading } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}>
        {!token ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={BottomTabs} />
            <Stack.Screen name="MemberDetail" component={MemberDetailScreen} />
          </>
        )}
        {/* Public statement screen can be viewed anytime via deep link or token */}
        <Stack.Screen name="Statement" component={StatementScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

