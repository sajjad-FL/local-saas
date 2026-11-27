import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getApiBaseUrl, setApiBaseUrl } from '../../api/api';
import Icon from '../../components/Icon';
import Logo, { BRAND_IMAGES } from '../../components/Logo';
import { Spinner } from '../../components/Loader';

const TYPES = [
  { key: 'hostel', title: 'PG accommodations and hostels', blurb: 'Manage rooms, beds and members' },
  { key: 'tuition', title: 'Tuition and coaching centres', blurb: 'Manage batches, students and fees' },
  { key: 'gym', title: 'Gyms', blurb: 'Manage members, plans and attendance' },
  { key: 'mess', title: 'Mess and tiffin', blurb: 'Manage meal plans and monthly dues' },
];

// A labelled input in the LocalSaaS style: icon (or +91), the field, an optional button at the end
function Field({ theme, label, icon, prefix, right, ...input }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: theme.colors.card, borderColor: focus ? theme.colors.primary : theme.colors.border }]}>
        {prefix ? (
          <Text style={[styles.prefix, { color: theme.colors.text, borderRightColor: theme.colors.border }]}>{prefix}</Text>
        ) : (
          <Icon name={icon} size={19} color={theme.colors.textSecondary} />
        )}
        <TextInput
          {...input}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text }]}
        />
        {right}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { login, signUp } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [step, setStep] = useState(1); // sign-up: 1 type, 2 you, 3 your business
  const [type, setType] = useState('hostel');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [business, setBusiness] = useState('');
  const [upiId, setUpiId] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // where the API lives, changeable from a small link at the bottom
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  useEffect(() => {
    getApiBaseUrl().then(setServerUrl).catch(() => {});
  }, []);

  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const goTo = (m) => { setError(''); setMode(m); setStep(1); };

  const handleLogin = async () => {
    setError('');
    if (cleanPhone.length !== 10) return setError('Enter your 10-digit mobile number');
    if (!password) return setError('Enter your password');
    setLoading(true);
    try {
      await login(cleanPhone, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const next = async () => {
    setError('');
    if (step === 1) return setStep(2);
    if (step === 2) {
      if (!name.trim()) return setError('Enter your full name');
      if (cleanPhone.length !== 10) return setError('Enter your 10-digit mobile number');
      if (password.length < 6) return setError('Use at least 6 characters for the password');
      return setStep(3);
    }
    if (!business.trim()) return setError('Enter your business name');
    setLoading(true);
    try {
      await signUp({ name: name.trim(), phone: cleanPhone, password, business: business.trim(), type, upiId: upiId.trim() });
    } catch (err) {
      setError(err.message || 'Sign-up failed');
      if (/phone/i.test(err.message || '')) setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const saveServer = async () => {
    try {
      const updated = await setApiBaseUrl(serverUrl);
      setServerUrl(updated);
      setShowServerConfig(false);
      Alert.alert('Saved', `Server set to ${updated}`);
    } catch {
      Alert.alert('Error', 'That address does not look right');
    }
  };

  const eye = (
    <TouchableOpacity onPress={() => setShow(!show)} accessibilityLabel={show ? 'Hide password' : 'Show password'} hitSlop={8}>
      <Icon name={show ? 'eye-outline' : 'eye-off-outline'} size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
  const errorBox = error ? (
    <View style={[styles.errorBox, { backgroundColor: theme.colors.dangerSoft }]}>
      <Icon name="alert-circle-outline" size={16} color={theme.colors.danger} />
      <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
    </View>
  ) : null;
  const primaryBtn = (title, onPress) => (
    <TouchableOpacity activeOpacity={0.85} disabled={loading} onPress={onPress}
      style={[styles.primaryBtn, { backgroundColor: theme.colors.primary, opacity: loading ? 0.6 : 1 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {loading && <Spinner size={20} color="#FFFFFF" track="rgba(255, 255, 255, 0.3)" />}
        <Text style={styles.primaryBtnText}>{loading ? 'Please wait…' : title}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: isDark ? theme.colors.background : '#F6F4FF' }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {mode === 'login' ? (
            <>
              <View style={styles.topRow}>
                <Logo size={34} />
                <TouchableOpacity onPress={toggleTheme} accessibilityLabel="Toggle theme"
                  style={[styles.themeBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Icon name={isDark ? 'sunny-outline' : 'moon-outline'} size={17} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.h1, { color: theme.colors.text }]}>Welcome back</Text>
              <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>Sign in to manage your business</Text>
              <Image source={BRAND_IMAGES.hero} style={styles.hero} resizeMode="contain" />

              {errorBox}
              <Field theme={theme} label="Mobile number" icon="person-outline" value={phone} onChangeText={setPhone}
                placeholder="Enter your mobile number" keyboardType="phone-pad" autoComplete="tel" />
              <Field theme={theme} label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword}
                placeholder="Enter your password" secureTextEntry={!show} autoComplete="password" right={eye} />
              {primaryBtn('Log in', handleLogin)}

              <View style={[styles.switchBox, { backgroundColor: isDark ? theme.colors.card : '#EEEAFE' }]}>
                <Text style={[styles.switchText, { color: theme.colors.textSecondary }]}>New to LocalSaaS?</Text>
                <TouchableOpacity onPress={() => goTo('signup')}>
                  <Text style={[styles.switchLink, { color: theme.colors.primary }]}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* sign-up: back, logo, three steps */}
              <View style={styles.signHead}>
                <TouchableOpacity onPress={() => (step > 1 ? setStep(step - 1) : goTo('login'))} accessibilityLabel="Back" hitSlop={10} style={styles.back}>
                  <Icon name="chevron-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Logo size={32} />
                <View style={styles.back} />
              </View>
              <View style={styles.steps}>
                {[1, 2, 3].map((n) => (
                  <React.Fragment key={n}>
                    {n > 1 && <View style={[styles.stepLine, { backgroundColor: n <= step ? theme.colors.primary : theme.colors.border }]} />}
                    <View style={[styles.stepDot, n <= step ? { backgroundColor: theme.colors.primary } : { backgroundColor: theme.colors.primarySoft }]}>
                      <Text style={{ color: n <= step ? '#FFFFFF' : theme.colors.textMuted, fontWeight: '700' }}>{n}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>

              {step === 1 && (
                <>
                  <Text style={[styles.h1, { color: theme.colors.text }]}>What type of business are you managing?</Text>
                  <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>Choose one to get started. You can add more businesses later.</Text>
                  <View style={styles.typeGrid}>
                    {TYPES.map((t) => {
                      const on = type === t.key;
                      return (
                        <TouchableOpacity key={t.key} activeOpacity={0.85} onPress={() => setType(t.key)}
                          accessibilityRole="radio" accessibilityState={{ checked: on }}
                          style={[styles.typeCard, {
                            backgroundColor: on ? theme.colors.primarySoft : theme.colors.card,
                            borderColor: on ? theme.colors.primary : theme.colors.border,
                          }]}>
                          <View style={[styles.typeCheck, on ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary } : { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                            {on && <Icon name="checkmark" size={14} color="#FFFFFF" />}
                          </View>
                          <Image source={BRAND_IMAGES[t.key]} style={styles.typeArt} resizeMode="contain" />
                          <Text style={[styles.typeTitle, { color: theme.colors.text }]}>{t.title}</Text>
                          <Text style={[styles.typeBlurb, { color: theme.colors.textSecondary }]}>{t.blurb}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {step === 2 && (
                <>
                  <Text style={[styles.h1, { color: theme.colors.text }]}>Create your account</Text>
                  <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>You sign in with your mobile number.</Text>
                  {errorBox}
                  <Field theme={theme} label="Full name" icon="person-outline" value={name} onChangeText={setName} placeholder="Enter your full name" autoComplete="name" />
                  <Field theme={theme} label="Mobile number" prefix="+91" value={phone} onChangeText={setPhone} placeholder="10-digit mobile number" keyboardType="phone-pad" autoComplete="tel" />
                  <Field theme={theme} label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword}
                    placeholder="Create a password" secureTextEntry={!show} right={eye} />
                </>
              )}

              {step === 3 && (
                <>
                  <Text style={[styles.h1, { color: theme.colors.text }]}>Name your business</Text>
                  <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>
                    {TYPES.find((t) => t.key === type)?.title} · you can change this later in Settings.
                  </Text>
                  {errorBox}
                  <Field theme={theme} label="Business name" icon="business-outline" value={business} onChangeText={setBusiness} placeholder="e.g. Green Nest PG" maxLength={60} />
                  <Field theme={theme} label="UPI ID (optional)" icon="qr-code-outline" value={upiId} onChangeText={setUpiId} placeholder="e.g. payments@ybl" autoCapitalize="none" />
                  <Text style={[styles.hint, { color: theme.colors.textMuted }]}>Your UPI ID goes into WhatsApp reminders so members can pay in one tap.</Text>
                </>
              )}

              {primaryBtn(step < 3 ? 'Continue' : 'Create account', next)}
              <View style={styles.inline}>
                <Text style={[styles.switchText, { color: theme.colors.textSecondary }]}>Already have an account? </Text>
                <TouchableOpacity onPress={() => goTo('login')}>
                  <Text style={[styles.switchLink, { color: theme.colors.primary, fontSize: 15 }]}>Log in</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* where the app's server lives */}
          <TouchableOpacity onPress={() => setShowServerConfig(!showServerConfig)} style={styles.serverLink}>
            <Text style={[styles.serverLinkText, { color: theme.colors.textMuted }]}>
              {showServerConfig ? 'Hide server settings' : 'Server settings'}
            </Text>
          </TouchableOpacity>
          {showServerConfig && (
            <View style={[styles.serverBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Field theme={theme} label="Server API address" icon="server-outline" value={serverUrl} onChangeText={setServerUrl}
                placeholder="https://your-server/api" autoCapitalize="none" keyboardType="url" />
              <TouchableOpacity onPress={saveServer} style={[styles.outlineBtn, { borderColor: theme.colors.border }]}>
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Save server address</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 22 },
  themeBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, lineHeight: 36 },
  sub: { fontSize: 16, marginTop: 6, marginBottom: 16, lineHeight: 22 },
  hero: { width: '100%', height: 220, marginBottom: 12 },
  field: { marginBottom: 16 },
  label: { fontSize: 15, fontWeight: '500', marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16 },
  prefix: { fontSize: 16, paddingRight: 12, borderRightWidth: 1 },
  // the field's purple border already shows focus; drop the browser's own focus box on web
  input: { flex: 1, fontSize: 16, paddingVertical: 12, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null) },
  hint: { fontSize: 13, marginTop: -6, marginBottom: 12, lineHeight: 18 },
  primaryBtn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 6, shadowColor: '#5B3DF5', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  switchBox: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 6, marginTop: 20 },
  switchText: { fontSize: 15 },
  switchLink: { fontSize: 17, fontWeight: '700' },
  inline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 14 },
  errorText: { flex: 1, fontSize: 13.5, fontWeight: '500' },
  signHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  back: { width: 32 },
  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 22 },
  stepDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 64, height: 3, borderRadius: 2 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  typeCard: { flexBasis: '47%', flexGrow: 1, borderWidth: 1.5, borderRadius: 18, padding: 14, paddingTop: 12 },
  typeCheck: { position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  typeArt: { width: '100%', height: 88, marginBottom: 8 },
  typeTitle: { fontSize: 15.5, fontWeight: '700', lineHeight: 20 },
  typeBlurb: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  serverLink: { alignSelf: 'center', marginTop: 26, padding: 6 },
  serverLinkText: { fontSize: 12.5, textDecorationLine: 'underline' },
  serverBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 8 },
  outlineBtn: { height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
