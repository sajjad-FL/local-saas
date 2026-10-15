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
  const { theme } = useTheme();
  const { login, register } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
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
      setError('Phone number is required');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    if (isRegister && !name.trim()) {
      setError('Full name is required for registration');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(name.trim(), phone.trim(), password);
      } else {
        await login(phone.trim(), password);
      }
    } catch (err) {
      setError(err.message || (isRegister ? 'Registration failed' : 'Login failed'));
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo & Brand Header */}
          <View style={styles.brandContainer}>
            <View style={[styles.logoWrap, { backgroundColor: theme.colors.primary }]}>
              <Icon name="cash" size={32} color="#FFFFFF" />
            </View>
            <Text style={[styles.brandTitle, { color: theme.colors.text }]}>local-saas</Text>
            <Text style={[styles.brandSubtitle, { color: theme.colors.textSecondary }]}>
              Payment tracking for gym, mess, tuition & hostel
            </Text>
          </View>

          {/* Form Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.xl,
              },
            ]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              {isRegister ? 'Create an Account' : 'Welcome Back'}
            </Text>
            <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>
              {isRegister
                ? 'Sign up to manage memberships, dues & WhatsApp reminders'
                : 'Enter your credentials to access your business workspaces'}
            </Text>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.colors.dangerSoft }]}>
                <Icon name="alert-circle-outline" size={16} color={theme.colors.danger} />
                <Text style={[styles.errorText, { color: theme.colors.dangerDark }]}>{error}</Text>
              </View>
            ) : null}

            {isRegister && (
              <Input
                label="Full Name *"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Ramesh Kumar"
                icon={<Icon name="person-outline" size={18} />}
              />
            )}

            <Input
              label="Phone Number *"
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 9876543210"
              keyboardType="phone-pad"
              icon={<Icon name="call-outline" size={18} />}
            />

            <Input
              label="Password *"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              secureTextEntry
              icon={<Icon name="lock-closed-outline" size={18} />}
            />

            <Button
              title={isRegister ? 'Create Account' : 'Sign In'}
              variant="primary"
              size="lg"
              loading={loading}
              onPress={handleSubmit}
              style={{ marginTop: 8 }}
            />

            {/* Toggle Mode */}
            <TouchableOpacity
              onPress={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              style={styles.switchModeBtn}>
              <Text style={[styles.switchModeText, { color: theme.colors.textSecondary }]}>
                {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
                <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
                  {isRegister ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Server Config Collapsible (crucial for connecting mobile app to PC backend) */}
          <TouchableOpacity
            style={styles.serverToggle}
            onPress={() => setShowServerConfig(!showServerConfig)}>
            <Icon name="server-outline" size={14} color={theme.colors.textMuted} />
            <Text style={[styles.serverToggleText, { color: theme.colors.textMuted }]}>
              {showServerConfig ? 'Hide Server Configuration' : 'Configure Server API URL'}
            </Text>
            <Icon
              name={showServerConfig ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          {showServerConfig && (
            <View
              style={[
                styles.serverBox,
                {
                  backgroundColor: theme.colors.cardSubtle,
                  borderColor: theme.colors.borderSubtle,
                  borderRadius: theme.radius.md,
                },
              ]}>
              <Input
                label="API Base URL"
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://10.0.2.2:4000/api"
                hint="For Android emulator use 10.0.2.2; for real devices use your PC LAN IP (e.g. http://192.168.1.5:4000/api)"
                autoCapitalize="none"
              />
              <Button
                title="Save API URL"
                variant="outline"
                size="sm"
                onPress={handleSaveServerUrl}
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
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    padding: 20,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12.5,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  switchModeBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 13,
  },
  serverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    padding: 8,
  },
  serverToggleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  serverBox: {
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
  },
});

