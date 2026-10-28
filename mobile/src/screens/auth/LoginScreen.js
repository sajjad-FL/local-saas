import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getApiBaseUrl, setApiBaseUrl } from '../../api/api';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

export default function LoginScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { login, register } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Server configuration
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    (async () => {
      const current = await getApiBaseUrl();
      setServerUrl(current);
    })();
  }, []);

  const handleSubmit = async () => {
    setError('');
    if (!phone.trim()) {
      setError('Mobile phone number is required');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setError('Full name is required for registration');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await register(name.trim(), phone.trim(), password);
      } else {
        await login(phone.trim(), password);
      }
    } catch (err) {
      setError(err.message || (mode === 'register' ? 'Registration failed' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServerUrl = async () => {
    try {
      const updated = await setApiBaseUrl(serverUrl);
      setServerUrl(updated);
      Alert.alert('Saved', `API Base URL set to: ${updated}`);
      setShowServerConfig(false);
    } catch {
      Alert.alert('Error', 'Invalid URL format');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Top right theme toggle matching web .auth-theme-toggle */}
      <View style={styles.topRight}>
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.themeBtn, { borderColor: theme.colors.border }]}>
          <Icon name={isDark ? 'sunny' : 'moon'} size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* Main Auth Card matching web .auth-card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}>
            {/* Brand Header */}
            <View style={styles.brandContainer}>
              <View style={[styles.logoWrap, { backgroundColor: theme.colors.primary }]}>
                <Icon name="barbell-outline" size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.brandTitle, { color: theme.colors.text }]}>Local SaaS</Text>
              <Text style={[styles.brandSubtitle, { color: theme.colors.textSecondary }]}>
                Billing, dues tracking & WhatsApp collections for gym, hostel, tuition & mess.
              </Text>
            </View>

            {/* Segmented Tab Switcher matching web .auth-tabs */}
            <View
              style={[
                styles.tabsContainer,
                { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border },
              ]}>
              <TouchableOpacity
                onPress={() => {
                  setError('');
                  setMode('login');
                }}
                style={[
                  styles.tabBtn,
                  mode === 'login' && [
                    styles.tabBtnActive,
                    { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                  ],
                ]}>
                <Text
                  style={[
                    styles.tabBtnText,
                    {
                      color: mode === 'login' ? theme.colors.text : theme.colors.textMuted,
                      fontWeight: mode === 'login' ? '600' : '500',
                    },
                  ]}>
                  Login
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setError('');
                  setMode('register');
                }}
                style={[
                  styles.tabBtn,
                  mode === 'register' && [
                    styles.tabBtnActive,
                    { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                  ],
                ]}>
                <Text
                  style={[
                    styles.tabBtnText,
                    {
                      color: mode === 'register' ? theme.colors.text : theme.colors.textMuted,
                      fontWeight: mode === 'register' ? '600' : '500',
                    },
                  ]}>
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.colors.dangerSoft }]}>
                <Icon name="alert-circle-outline" size={16} color={theme.colors.danger} />
                <Text style={[styles.errorText, { color: theme.colors.dangerDark }]}>{error}</Text>
              </View>
            ) : null}

            {mode === 'register' && (
              <Input
                label="Full Name *"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Rahul Sharma"
                icon={<Icon name="person-outline" size={18} />}
              />
            )}

            <Input
              label="Mobile Phone Number *"
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              icon={<Icon name="call-outline" size={18} />}
            />

            <Input
              label="Password *"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              icon={<Icon name="shield-checkmark-outline" size={18} />}
            />

            <Button
              title={mode === 'login' ? 'Sign In to Workspace' : 'Create Free Account'}
              variant="primary"
              size="md"
              loading={loading}
              onPress={handleSubmit}
              style={{ marginTop: 8 }}
            />

            <Text style={[styles.footerNote, { color: theme.colors.textMuted }]}>
              Works on any phone or computer · Data exportable anytime
            </Text>
          </View>

          {/* Server Config Collapsible */}
          <TouchableOpacity
            style={styles.serverToggle}
            onPress={() => setShowServerConfig(!showServerConfig)}>
            <Icon name="settings-outline" size={14} color={theme.colors.textMuted} />
            <Text style={[styles.serverToggleText, { color: theme.colors.textMuted }]}>
              {showServerConfig ? 'Hide API URL Settings' : 'Configure Server API URL'}
            </Text>
          </TouchableOpacity>

          {showServerConfig && (
            <View
              style={[
                styles.serverBox,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}>
              <Text style={[styles.serverBoxTitle, { color: theme.colors.text }]}>
                API Server Configuration
              </Text>
              <Text style={[styles.serverBoxHint, { color: theme.colors.textSecondary }]}>
                Default: http://localhost:4000/api
              </Text>
              <Input
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://192.168.1.100:4000/api"
                autoCapitalize="none"
              />
              <Button
                title="Save Server URL"
                variant="outline"
                size="sm"
                onPress={handleSaveServerUrl}
                style={{ marginTop: 4 }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topRight: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 20,
    right: 20,
    zIndex: 10,
  },
  themeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 40,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  tabsContainer: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabBtnActive: {
    borderWidth: 1,
  },
  tabBtnText: {
    fontSize: 12.5,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
  footerNote: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 18,
  },
  serverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 8,
  },
  serverToggleText: {
    fontSize: 12,
  },
  serverBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  serverBoxTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  serverBoxHint: {
    fontSize: 11,
    marginBottom: 10,
  },
});
