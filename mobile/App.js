import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { BizProvider } from './src/context/BizContext';
import AppNavigator from './src/navigation/AppNavigator';

function ThemedApp() {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <BizProvider>
            <ThemedApp />
          </BizProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
