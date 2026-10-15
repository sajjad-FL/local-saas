import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme } from '../constants/theme';
import { STORAGE_KEYS } from '../api/api';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('dark'); // Default to modern sleek dark theme matching web

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
        if (saved) {
          setThemeMode(saved);
        } else if (systemScheme) {
          setThemeMode(systemScheme);
        }
      } catch {
        // fallback
      }
    })();
  }, [systemScheme]);

  const toggleTheme = async () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, next);
  };

  const isDark = themeMode === 'dark';
  const theme = getTheme(isDark);

  return (
    <ThemeContext.Provider value={{ theme, isDark, themeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

