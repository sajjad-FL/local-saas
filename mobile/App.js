import React from 'react';
import { useFonts } from 'expo-font';
import { INTER } from './src/ui/interText';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { BizProvider } from './src/context/BizContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';

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
  // Inter, the web app's font; until it's ready the screen stays blank for a moment
  const [fontsReady, fontError] = useFonts(INTER);
  if (!fontsReady && !fontError) return null;
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <BizProvider>
              <ThemedApp />
            </BizProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

