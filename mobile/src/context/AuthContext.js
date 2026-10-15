import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, parseToken, STORAGE_KEYS } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
        if (savedToken) {
          const parsed = parseToken(savedToken);
          // Check expiration
          if (parsed && parsed.exp && parsed.exp * 1000 > Date.now()) {
            setToken(savedToken);
            setUser(parsed);
          } else {
            await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
          }
        }
      } catch (err) {
        console.warn('Error reading stored token', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (phone, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { phone, password },
    });
    if (data?.token) {
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
      setToken(data.token);
      setUser(parseToken(data.token));
      return data;
    }
    throw new Error(data?.error || 'Login failed');
  };

  const register = async (name, phone, password) => {
    const data = await api('/auth/register', {
      method: 'POST',
      body: { name, phone, password },
    });
    if (data?.token) {
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
      setToken(data.token);
      setUser(parseToken(data.token));
      return data;
    }
    throw new Error(data?.error || 'Registration failed');
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.BIZ_ID);
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, register, logout, userId: user?.userId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

