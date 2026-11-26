import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, getApiBaseUrl, setApiBaseUrl, STORAGE_KEYS } from '../../api/api';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import { downloadFile } from '../../api/download';
import { BIZ_CONFIG, tint } from '../../constants/theme';
import { words } from '../../constants/wording';
import AsyncStorage from '@react-native-async-storage/async-storage';


export default function SettingsScreen({ navigation }) {
  const { logout, user } = useAuth();
  const { biz, isOwner, updateBusiness, refetch } = useBiz();
  const { theme, isDark, toggleTheme } = useTheme();

  // one page like the web; these open the small forms in place
  const [editProfile, setEditProfile] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [editBizName, setEditBizName] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

  // Profile: the signed-in person's own details, from /me (the sign-in token has no name or phone)
  const [me, setMe] = useState(null);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [phonePassword, setPhonePassword] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordAgain, setNewPasswordAgain] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    api('/me').then((m) => {
      setMe(m);
      setUserName(m?.name || '');
      setUserPhone(m?.phone || '');
    }).catch(console.warn);
  }, []);

  const phoneChanged = !!me && userPhone !== me.phone;
  const profileChanged = !!me && (userName.trim() !== (me.name || '') || phoneChanged);
  const handleSaveProfile = async () => {
    setProfileBusy(true); setProfileError(''); setProfileMsg('');
    try {
      const body = { name: userName };
      if (phoneChanged) Object.assign(body, { phone: userPhone, currentPassword: phonePassword });
      const updated = await api('/me', { method: 'PATCH', body });
      setMe((old) => ({ ...old, ...updated }));
      setPhonePassword('');
      setProfileMsg(phoneChanged ? 'Saved. Sign in with your new number from now on.' : 'Saved.');
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileBusy(false);
    }
  };
  const handleChangePassword = async () => {
    setPwdLoading(true); setPwdError(''); setPwdMsg('');
    try {
      await api('/me/password', { method: 'POST', body: { currentPassword, newPassword } });
      setCurrentPassword(''); setNewPassword(''); setNewPasswordAgain('');
      setPwdMsg('Password changed.');
    } catch (err) {
      setPwdError(err.message);
    } finally {
      setPwdLoading(false);
    }
  };
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('') || '?';

  // UPI Form
  const [upiId, setUpiId] = useState(biz?.upiId || '');
  const [upiSaving, setUpiSaving] = useState(false);

  // Notifications Form
  const [autoRemind, setAutoRemind] = useState(biz?.notifications?.renewalReminders !== false);
  const [reminderDays, setReminderDays] = useState(biz?.reminderEveryDays || 3);
  const [attendanceEnabled, setAttendanceEnabled] = useState(biz?.attendanceEnabled !== false);
  const [salesEnabled, setSalesEnabled] = useState(biz?.salesEnabled !== false);

  // Staff Form & List
  const [staffList, setStaffList] = useState([]);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [staffPhone, setStaffPhone] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');

  // Business Profile Form
  const [bizName, setBizName] = useState(biz?.name || '');
  const [bizSaving, setBizSaving] = useState(false);

  // Server URL
  const [serverUrl, setServerUrl] = useState('');
  const [serverModalOpen, setServerModalOpen] = useState(false);

  useEffect(() => {
    if (biz) {
      setUpiId(biz.upiId || '');
      setBizName(biz.name || '');
      setAutoRemind(biz.notifications?.renewalReminders !== false);
      setReminderDays(biz.reminderEveryDays || 3);
      setAttendanceEnabled(biz.attendanceEnabled !== false);

      if (isOwner) {
        api(`/businesses/${biz._id}/staff`).then((res) => {
          setStaffList(Array.isArray(res) ? res : []);
        }).catch(console.warn);
      }
    }
  }, [biz, isOwner]);

  useEffect(() => {
    getApiBaseUrl().then(setServerUrl);
  }, []);

  const handleSaveUpi = async () => {
    setUpiSaving(true);
    try {
      await updateBusiness(biz._id, { upiId: upiId.trim() });
      Alert.alert('Saved', 'UPI VPA ID updated successfully');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setUpiSaving(false);
    }
  };

  const handleSaveBizName = async () => {
    if (!bizName.trim()) return;
    setBizSaving(true);
    try {
      await updateBusiness(biz._id, { name: bizName.trim() });
      Alert.alert('Saved', 'Business name updated.');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setBizSaving(false);
    }
  };

  const handleSaveNotifications = async (newAuto, newDays) => {
    try {
      await updateBusiness(biz._id, {
        reminderEveryDays: newDays,
        notifications: {
          ...biz.notifications,
          renewalReminders: newAuto,
        },
      });
      setAutoRemind(newAuto);
      setReminderDays(newDays);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleToggleSales = async (val) => {
    try {
      await updateBusiness(biz._id, { salesEnabled: val });
      setSalesEnabled(val);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleToggleAttendance = async (val) => {
    try {
      await updateBusiness(biz._id, { attendanceEnabled: val });
      setAttendanceEnabled(val);
      Alert.alert('Updated', `Attendance tracking ${val ? 'enabled' : 'disabled'}`);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleAddStaff = async () => {
    if (!staffPhone.trim()) {
      setStaffError('Phone number is required');
      return;
    }
    setStaffLoading(true);
    setStaffError('');
    try {
      const added = await api(`/businesses/${biz._id}/staff`, {
        method: 'POST',
        body: { phone: staffPhone.trim(), name: staffName.trim() || undefined },
      });
      setStaffList((prev) => [...prev, added]);
      setAddStaffOpen(false);
      setStaffPhone('');
      setStaffName('');
      Alert.alert('Staff Added', 'Staff member can now log in using their phone number.');
    } catch (err) {
      setStaffError(err.message || 'Failed to add staff');
    } finally {
      setStaffLoading(false);
    }
  };

  const handleRemoveStaff = (staffUserId) => {
    Alert.alert('Remove Staff?', 'This person will no longer have access to this workspace.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/businesses/${biz._id}/staff/${staffUserId}`, { method: 'DELETE' });
            setStaffList((prev) => prev.filter((s) => s._id !== staffUserId));
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleSaveServer = async () => {
    try {
      const updated = await setApiBaseUrl(serverUrl);
      setServerUrl(updated);
      setServerModalOpen(false);
      Alert.alert('Updated', `API URL set to: ${updated}`);
    } catch {
      Alert.alert('Error', 'Invalid URL format');
    }
  };

  // Backups: fetched with the sign-in token, then shared or downloaded
  const [downloading, setDownloading] = useState('');
  const handleDownload = async (key, path, filename) => {
    setDownloading(key);
    try {
      await downloadFile(`/businesses/${biz._id}/${path}`, filename);
    } catch (err) {
      Alert.alert('Download failed', err.message);
    } finally {
      setDownloading('');
    }
  };

  // Danger zone: type DELETE to confirm, same as the web
  const [danger, setDanger] = useState(null); // 'clear' | 'delete'
  const [dangerInput, setDangerInput] = useState('');
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerError, setDangerError] = useState('');
  const openDanger = (kind) => { setDanger(kind); setDangerInput(''); setDangerError(''); };
  const runDanger = async () => {
    setDangerBusy(true);
    setDangerError('');
    try {
      if (danger === 'clear') {
        await api(`/businesses/${biz._id}/clear-data`, { method: 'POST' });
      } else {
        await api(`/businesses/${biz._id}`, { method: 'DELETE' });
        await AsyncStorage.removeItem(STORAGE_KEYS.BIZ_ID);
      }
      setDanger(null);
      await refetch();
      navigation.navigate('Main', { screen: 'Dashboard' });
    } catch (err) {
      setDangerError(err.message || 'Something went wrong');
    } finally {
      setDangerBusy(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out?', 'Are you sure you want to log out of your session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const c = theme.colors;
  const W = words(biz?.type);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <TopBar navigation={navigation} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* who you are, and the page title (the web's st-head) */}
        <View style={ws.head}>
          <View style={[ws.avatar, { backgroundColor: c.primary }]}><Text style={ws.avatarText}>{initials(me?.name)}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[ws.headSub, { color: c.textMuted }]} numberOfLines={1}>{me?.name || 'You'}{me?.phone ? ` · +91 ${me.phone}` : ''}</Text>
            <Text style={[ws.h1, { color: c.text }]}>Settings</Text>
          </View>
          <TouchableOpacity onPress={() => setEditProfile((o) => !o)} style={[ws.outline, { borderColor: c.border, backgroundColor: c.card }]}>
            <Icon name="person-outline" size={14} color={c.text} />
            <Text style={[ws.outlineText, { color: c.text }]}>{editProfile ? 'Done' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {/* at a glance */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
          {[
            { text: `UPI payments: ${biz?.upiId ? 'Set up' : 'Not set up'}`, ok: !!biz?.upiId },
            { text: `Auto reminders: ${autoRemind ? 'On' : 'Off'}`, ok: autoRemind, warn: !autoRemind },
          ].map((x) => (
            <View key={x.text} style={[ws.chip, { backgroundColor: x.ok ? c.successSoft : x.warn ? c.warningSoft : c.dangerSoft }]}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: x.ok ? c.moneyGreen : x.warn ? c.moneyAmber : c.moneyRed }}>{x.text}</Text>
            </View>
          ))}
        </ScrollView>

        {/* your name and number (the web opens this from Edit) */}
        {editProfile && (
          <View style={[ws.card, ws.pad, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[ws.cardTitle, { color: c.text }]}>Your profile</Text>
            <Text style={[ws.label, { color: c.textSecondary }]}>Your name</Text>
            <TextInput value={userName} onChangeText={(v) => { setUserName(v); setProfileMsg(''); }} maxLength={60} placeholder="Your name" placeholderTextColor={c.textMuted}
              style={[ws.input, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]} />
            <Text style={[ws.label, { color: c.textSecondary }]}>Mobile number (you sign in with this)</Text>
            <TextInput value={userPhone} onChangeText={(v) => { setUserPhone(v.replace(/\D/g, '').slice(0, 10)); setProfileMsg(''); }} keyboardType="number-pad" placeholder="10-digit number" placeholderTextColor={c.textMuted}
              style={[ws.input, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]} />
            {phoneChanged && (
              <>
                <Text style={[ws.label, { color: c.textSecondary }]}>Current password (needed to change your number)</Text>
                <TextInput value={phonePassword} onChangeText={setPhonePassword} secureTextEntry style={[ws.input, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]} />
              </>
            )}
            {!!profileError && <Text style={[ws.msg, { color: c.danger }]}>{profileError}</Text>}
            {!!profileMsg && <Text style={[ws.msg, { color: c.moneyGreen }]}>✓ {profileMsg}</Text>}
            <TouchableOpacity disabled={!profileChanged || profileBusy || !userName.trim() || userPhone.length !== 10 || (phoneChanged && !phonePassword)} onPress={handleSaveProfile}
              style={[ws.primary, { backgroundColor: c.primary, opacity: !profileChanged || profileBusy ? 0.55 : 1 }]}>
              <Icon name="checkmark" size={15} color="#fff" /><Text style={ws.primaryText}>{profileBusy ? 'Saving…' : 'Save changes'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* how members pay you */}
        <View style={[ws.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={ws.cardHead}>
            <View style={[ws.cardIcon, { backgroundColor: theme.isDark ? 'rgba(52,211,153,0.12)' : '#ECFDF3' }]}><Text style={{ color: c.moneyGreen, fontWeight: '700' }}>₹</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[ws.cardTitle, { color: c.text, marginBottom: 0 }]}>How members pay you</Text>
              <Text style={[ws.cardSub, { color: c.textMuted }]}>Reminders and statements carry a 1-tap pay link. Money goes straight to you.</Text>
            </View>
          </View>
          <View style={ws.padX}>
            <Text style={[ws.label, { color: c.text }]}>Your UPI ID</Text>
            <TextInput value={upiId} onChangeText={setUpiId} editable={isOwner} placeholder="e.g. yourgym@ybl" placeholderTextColor={c.textMuted} autoCapitalize="none"
              style={[ws.input, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text, fontFamily: 'monospace' }]} />
            <Text style={[ws.hint, { color: c.textMuted }]}>Find it in your UPI app (PhonePe, GPay, Paytm) under your profile.</Text>
            {isOwner ? (
              <TouchableOpacity disabled={upiSaving} onPress={handleSaveUpi} style={[ws.primary, { backgroundColor: c.primary, alignSelf: 'flex-end', paddingHorizontal: 60 }]}>
                <Icon name="checkmark" size={15} color="#fff" /><Text style={ws.primaryText}>{upiSaving ? 'Saving…' : 'Save UPI ID'}</Text>
              </TouchableOpacity>
            ) : <Text style={[ws.hint, { color: c.textMuted }]}>Only the owner can change this.</Text>}
          </View>
        </View>

        {/* WhatsApp reminders */}
        <View style={[ws.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={ws.cardHead}>
            <View style={[ws.cardIcon, { backgroundColor: theme.isDark ? 'rgba(52,211,153,0.12)' : '#E7F8EE' }]}><Icon name="logo-whatsapp" size={16} color={theme.isDark ? '#34D399' : '#15803D'} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[ws.cardTitle, { color: c.text, marginBottom: 0 }]}>WhatsApp reminders</Text>
              <Text style={[ws.cardSub, { color: c.textMuted }]}>Every day at 10 AM, {W.member}s who owe get one, with your pay link</Text>
            </View>
          </View>
          <View style={[ws.row, { borderTopColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[ws.rowTitle, { color: c.text }]}>Send them automatically</Text>
              <Text style={[ws.rowSub, { color: c.textMuted }]}>{autoRemind ? 'On' : 'Off'}</Text>
            </View>
            <Switch value={autoRemind} disabled={!isOwner} onValueChange={(v) => handleSaveNotifications(v, reminderDays)} trackColor={{ false: c.borderSolid, true: c.primary }} thumbColor="#FFFFFF" activeThumbColor="#FFFFFF" />
          </View>
          <View style={[ws.row, { borderTopColor: c.border, flexDirection: 'column', alignItems: 'stretch', gap: 0 }]}>
            <Text style={[ws.rowTitle, { color: c.text }]}>Same {W.member} at most every</Text>
            <Text style={[ws.rowSub, { color: c.textMuted }]}>Fewer messages keep {W.member}s from muting you</Text>
            <View style={[ws.seg, { backgroundColor: c.cardSubtle, marginTop: 10 }]}>
              {[3, 5, 7].map((d) => {
                const on = reminderDays === d;
                return (
                  <TouchableOpacity key={d} disabled={!isOwner} onPress={() => handleSaveNotifications(autoRemind, d)} style={[ws.segBtn, { flex: 1 }, on && { backgroundColor: c.card }]}>
                    <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400', color: on ? c.text : c.textSecondary }}>{d} days</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[ws.waPreview, { backgroundColor: theme.isDark ? '#0B141A' : '#ECE5DD' }]}>
              <View style={[ws.waBubble, { backgroundColor: theme.isDark ? '#005C4B' : '#DCF8C6' }]}>
                <Text style={{ fontSize: 13, lineHeight: 19, color: theme.isDark ? '#E9EDEF' : '#111B21' }}>Hi Rohit, your payment of ₹1,500 for {biz?.name} is pending. Please pay at the earliest. Thank you!</Text>
                <Text style={{ fontSize: 11, color: '#667781', textAlign: 'right', marginTop: 2 }}>10:00 AM</Text>
              </View>
            </View>
          </View>
        </View>

        {/* this outlet */}
        <View style={[ws.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[ws.cardHead, { paddingBottom: 12 }]}>
            <View style={[ws.outletAv, { backgroundColor: c.primarySoft }]}><Text style={{ color: c.primaryDark, fontWeight: '700' }}>{initials(biz?.name)}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              {editBizName ? (
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <TextInput value={bizName} onChangeText={setBizName} autoFocus style={[ws.input, { flex: 1, marginBottom: 0, height: 38, backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]} />
                  <TouchableOpacity onPress={async () => { await handleSaveBizName(); setEditBizName(false); }} style={[ws.outline, { borderColor: c.border }]}><Text style={[ws.outlineText, { color: c.text }]}>{bizSaving ? '…' : 'Save'}</Text></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity disabled={!isOwner} onPress={() => setEditBizName(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[ws.cardTitle, { color: c.text, marginBottom: 0 }]} numberOfLines={1}>{biz?.name}</Text>
                  {isOwner && <Icon name="create-outline" size={14} color={c.textMuted} />}
                </TouchableOpacity>
              )}
              <Text style={[ws.cardSub, { color: c.textMuted }]}>{`${BIZ_CONFIG[biz?.type]?.label || biz?.type} · this outlet's settings`}</Text>
            </View>
          </View>
          {isOwner && [
            { key: 'att', icon: 'calendar-outline', tone: [theme.isDark ? 'rgba(96,165,250,0.14)' : '#EEF4FF', theme.isDark ? '#93C5FD' : '#1D4ED8'], title: 'Attendance', sub: 'Staff mark who came each day. Never changes fees.', value: attendanceEnabled, onChange: handleToggleAttendance },
            { key: 'sell', icon: 'pricetag-outline', tone: [theme.isDark ? 'rgba(251,191,36,0.14)' : '#FFF6E5', theme.isDark ? '#FBBF24' : '#B45309'], title: 'Sell products & services', sub: 'Shows Sales in the menu and Sell on Collect and member pages.', value: salesEnabled, onChange: handleToggleSales },
          ].map((r) => (
            <View key={r.key} style={[ws.row, { borderTopColor: c.border }]}>
              <View style={[ws.rowIcon, { backgroundColor: r.tone[0] }]}><Icon name={r.icon} size={15} color={r.tone[1]} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[ws.rowTitle, { color: c.text }]}>{r.title}</Text>
                <Text style={[ws.rowSub, { color: c.textMuted }]}>{r.sub}</Text>
              </View>
              <Switch value={r.value} onValueChange={r.onChange} trackColor={{ false: c.borderSolid, true: c.primary }} thumbColor="#FFFFFF" activeThumbColor="#FFFFFF" />
            </View>
          ))}
          {isOwner && (
            <TouchableOpacity onPress={() => setStaffOpen((o) => !o)} style={[ws.row, { borderTopColor: c.border }]}>
              <View style={[ws.rowIcon, { backgroundColor: theme.isDark ? 'rgba(244,114,182,0.14)' : '#FCEEF6' }]}><Icon name="people-outline" size={15} color={theme.isDark ? '#F9A8D4' : '#9D1C5E'} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[ws.rowTitle, { color: c.text }]}>Staff & their access</Text>
                <Text style={[ws.rowSub, { color: c.textMuted }]}>{staffList.length} {staffList.length === 1 ? 'person' : 'people'} can open this outlet</Text>
              </View>
              <Text style={[ws.go, { color: c.primaryDark }]}>{staffOpen ? 'Hide' : 'Manage'} ›</Text>
            </TouchableOpacity>
          )}
          {isOwner && staffOpen && (
            <View style={[ws.padX, { paddingBottom: 12, gap: 8 }]}>
              {staffList.map((s) => (
                <View key={s._id} style={[ws.staff, { backgroundColor: c.cardSubtle, borderColor: c.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[ws.rowTitle, { color: c.text }]}>{s.name || 'Staff member'}</Text>
                    <Text style={[ws.rowSub, { color: c.textMuted }]}>{s.phone}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveStaff(s._id)} accessibilityLabel={`Remove ${s.name || 'staff'}`} style={{ padding: 6 }}>
                    <Icon name="trash-outline" size={16} color={c.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => { setStaffError(''); setAddStaffOpen(true); }} style={[ws.outline, { borderColor: c.border, alignSelf: 'flex-start' }]}>
                <Icon name="add" size={14} color={c.text} /><Text style={[ws.outlineText, { color: c.text }]}>Add staff</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={() => navigation.navigate('Setup')} style={[ws.row, { borderTopColor: c.border }]}>
            <View style={[ws.rowIcon, { backgroundColor: theme.isDark ? 'rgba(52,211,153,0.12)' : '#ECFDF3' }]}><Icon name="card-outline" size={15} color={c.moneyGreen} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[ws.rowTitle, { color: c.text }]}>{biz?.type === 'hostel' ? 'Plans & rooms' : 'Plans & batches'}</Text>
              <Text style={[ws.rowSub, { color: c.textMuted }]}>Fees, cycles{biz?.type === 'hostel' ? ', buildings and rooms' : ' and batches'}</Text>
            </View>
            <Text style={[ws.go, { color: c.primaryDark }]}>Setup ›</Text>
          </TouchableOpacity>
        </View>

        {/* download your data */}
        <View style={[ws.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={ws.cardHead}>
            <View style={[ws.cardIcon, { backgroundColor: theme.isDark ? 'rgba(96,165,250,0.14)' : '#EEF4FF' }]}><Icon name="download-outline" size={15} color={theme.isDark ? '#93C5FD' : '#1D4ED8'} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[ws.cardTitle, { color: c.text, marginBottom: 0 }]}>Download your data</Text>
              <Text style={[ws.cardSub, { color: c.textMuted }]}>Opens in Excel or Google Sheets</Text>
            </View>
          </View>
          <View style={ws.downloads}>
            {[
              isOwner && ['backup', 'Everything', 'Full backup file', 'export/backup.json', `${biz?.name}-full-backup.json`],
              ['payments', 'Payments', 'Every payment received', 'export/payments.csv', `${biz?.name}-payments.csv`],
              ['dues', 'Unpaid fees', 'Who owes what', 'export/dues.csv', `${biz?.name}-unpaid-fees.csv`],
              ['expenses', 'Expenses', 'Everything you spent', 'export/expenses.csv', `${biz?.name}-expenses.csv`],
            ].filter(Boolean).map(([key, title, sub, path, file]) => (
              <TouchableOpacity key={key} disabled={Boolean(downloading)} onPress={() => handleDownload(key, path, file)}
                style={[ws.dl, { backgroundColor: c.cardSubtle, borderColor: c.border, opacity: downloading && downloading !== key ? 0.6 : 1 }]}>
                <Text style={[ws.dlTitle, { color: c.text }]}>{downloading === key ? 'Preparing…' : title}</Text>
                <Text style={[ws.dlSub, { color: c.textMuted }]}>{sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* look, password, sign out */}
        <View style={[ws.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[ws.row, { borderTopWidth: 0, flexDirection: 'column', alignItems: 'stretch', gap: 0 }]}>
            <Text style={[ws.rowTitle, { color: c.text }]}>Look</Text>
            <Text style={[ws.rowSub, { color: c.textMuted }]}>On this device</Text>
            <View style={[ws.seg, { backgroundColor: c.cardSubtle, marginTop: 10 }]}>
              {[['light', 'Light', 'sunny-outline'], ['dark', 'Dark', 'moon-outline']].map(([k, label, icon]) => {
                const on = (k === 'dark') === isDark;
                return (
                  <TouchableOpacity key={k} onPress={() => { if (!on) toggleTheme(); }} style={[ws.segBtn, { flex: 1, flexDirection: 'row', gap: 6 }, on && { backgroundColor: c.card }]}>
                    <Icon name={icon} size={14} color={on ? c.text : c.textSecondary} />
                    <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400', color: on ? c.text : c.textSecondary }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={[ws.row, { borderTopColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[ws.rowTitle, { color: c.text }]}>Password</Text>
              <Text style={[ws.rowSub, { color: c.textMuted }]}>At least 6 characters</Text>
            </View>
            <TouchableOpacity onPress={() => setPwOpen((o) => !o)} style={[ws.outline, { borderColor: c.border }]}><Text style={[ws.outlineText, { color: c.text }]}>{pwOpen ? 'Close' : 'Change'}</Text></TouchableOpacity>
          </View>
          {pwOpen && (
            <View style={[ws.padX, { paddingBottom: 14 }]}>
              {[['Current password', currentPassword, setCurrentPassword], ['New password', newPassword, setNewPassword], ['New password again', newPasswordAgain, setNewPasswordAgain]].map(([label, value, set]) => (
                <View key={label}>
                  <Text style={[ws.label, { color: c.textSecondary }]}>{label}</Text>
                  <TextInput value={value} onChangeText={(v) => { set(v); setPwdMsg(''); }} secureTextEntry style={[ws.input, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]} />
                </View>
              ))}
              {!!newPasswordAgain && newPassword !== newPasswordAgain && <Text style={[ws.msg, { color: c.danger }]}>{"The two new passwords don't match."}</Text>}
              {!!pwdError && <Text style={[ws.msg, { color: c.danger }]}>{pwdError}</Text>}
              {!!pwdMsg && <Text style={[ws.msg, { color: c.moneyGreen }]}>✓ {pwdMsg}</Text>}
              <TouchableOpacity disabled={pwdLoading || !currentPassword || newPassword.length < 6 || newPassword !== newPasswordAgain} onPress={handleChangePassword}
                style={[ws.primary, { backgroundColor: c.primary, opacity: pwdLoading || !currentPassword || newPassword.length < 6 || newPassword !== newPasswordAgain ? 0.55 : 1 }]}>
                <Icon name="checkmark" size={15} color="#fff" /><Text style={ws.primaryText}>{pwdLoading ? 'Saving…' : 'Change password'}</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={[ws.row, { borderTopColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[ws.rowTitle, { color: c.text }]}>Server</Text>
              <Text style={[ws.rowSub, { color: c.textMuted }]} numberOfLines={1}>{serverUrl}</Text>
            </View>
            <TouchableOpacity onPress={() => setServerModalOpen(true)} style={[ws.outline, { borderColor: c.border }]}><Text style={[ws.outlineText, { color: c.text }]}>Change</Text></TouchableOpacity>
          </View>
          <View style={[ws.row, { borderTopColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[ws.rowTitle, { color: c.text }]}>Sign out</Text>
              <Text style={[ws.rowSub, { color: c.textMuted }]}>On this device only</Text>
            </View>
            <TouchableOpacity onPress={handleSignOut} style={[ws.outline, { borderColor: c.border }]}>
              <Icon name="log-out-outline" size={14} color={c.text} /><Text style={[ws.outlineText, { color: c.text }]}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* danger zone, folded like the web's <details> */}
        {isOwner && (
          <View style={[ws.danger, { backgroundColor: c.card, borderColor: tint('#B42318', 0.3, c.card) }]}>
            <TouchableOpacity onPress={() => setDangerOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name={dangerOpen ? 'caret-down' : 'caret-forward'} size={12} color={c.moneyRed} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.moneyRed }}>Danger zone · clear data or delete this outlet</Text>
            </TouchableOpacity>
            {dangerOpen && [
              { kind: 'clear', title: 'Clear all member data', sub: 'Removes every member, payment, due and subscription. Cannot be undone.', btn: 'Clear data' },
              { kind: 'delete', title: 'Delete this outlet', sub: 'Deletes this business and everything in it. Cannot be undone.', btn: 'Delete outlet' },
            ].map((d) => (
              <View key={d.kind} style={[ws.row, { borderTopColor: c.border, paddingHorizontal: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[ws.rowTitle, { color: c.text }]}>{d.title}</Text>
                  <Text style={[ws.rowSub, { color: c.textMuted }]}>{d.sub}</Text>
                </View>
                <TouchableOpacity onPress={() => openDanger(d.kind)} style={[ws.outline, { borderColor: tint('#B42318', 0.4, c.card) }]}>
                  <Text style={[ws.outlineText, { color: c.moneyRed }]}>{d.btn}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Staff Modal */}
      <Modal
        visible={addStaffOpen}
        onClose={() => setAddStaffOpen(false)}
        title="Add Staff Member"
        subtitle="Staff members can record payments and manage attendance.">
        <View style={{ gap: 12 }}>
          {staffError ? <Text style={styles.errorText}>{staffError}</Text> : null}

          <Input
            label="Staff Name (Optional)"
            value={staffName}
            onChangeText={setStaffName}
            placeholder="e.g. Ramesh Kumar"
          />

          <Input
            label="Staff Mobile Phone *"
            value={staffPhone}
            onChangeText={setStaffPhone}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
          />

          <Button
            title="Create Staff Account"
            variant="primary"
            loading={staffLoading}
            onPress={handleAddStaff}
          />
        </View>
      </Modal>

      {/* Edit Server URL Modal */}
      <Modal
        visible={serverModalOpen}
        onClose={() => setServerModalOpen(false)}
        title="API Server URL"
        subtitle="Backend endpoint connection">
        <View style={{ gap: 12 }}>
          <Input
            label="Backend Server URL"
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://localhost:5000/api"
            autoCapitalize="none"
          />

          <Button title="Save Server URL" variant="primary" onPress={handleSaveServer} />
        </View>
      </Modal>
      <Modal
        visible={Boolean(danger)}
        onClose={() => setDanger(null)}
        position="center"
        title={danger === 'clear' ? 'Clear All Member Data?' : `Delete "${biz?.name}" Workspace?`}>
        <Text style={[styles.dangerSub, { color: theme.colors.textSecondary, fontSize: 13, marginBottom: 14 }]}>
          {danger === 'clear'
            ? `This will permanently erase all members, payments, and billing records for ${biz?.name}. This action cannot be undone.`
            : `This will permanently destroy the entire ${biz?.name} workspace, plans, and all member data.`}
        </Text>
        <Text style={[styles.formLabel, { color: theme.colors.text }]}>
          Type <Text style={{ color: theme.colors.danger, fontWeight: '800' }}>DELETE</Text> to confirm:
        </Text>
        <TextInput
          value={dangerInput}
          onChangeText={setDangerInput}
          autoCapitalize="characters"
          placeholder="DELETE"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.inputBox, { marginTop: 6, backgroundColor: theme.colors.inputBg, color: theme.colors.text, borderColor: dangerInput === 'DELETE' ? theme.colors.danger : theme.colors.inputBorder }]}
        />
        {dangerError ? <Text style={{ color: theme.colors.danger, fontSize: 12.5, marginTop: 8 }}>{dangerError}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Button title="Cancel" variant="outline" onPress={() => setDanger(null)} style={{ flex: 1 }} />
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={dangerInput !== 'DELETE' || dangerBusy}
            onPress={runDanger}
            style={[styles.dangerBtn, { flex: 1, height: 44, backgroundColor: theme.colors.danger, opacity: dangerInput !== 'DELETE' || dangerBusy ? 0.5 : 1 }]}>
            <Text style={styles.dangerBtnText}>
              {dangerBusy ? 'Working…' : danger === 'clear' ? 'Clear All Data' : 'Delete Workspace'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dangerCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 10,
  },
  dangerTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  dangerSub: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  dangerBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 40,
  },
  pageHeader: {
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  shortcutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  shortcutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  shortcutSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  tabsScrollWrap: {
    marginBottom: 14,
  },
  tabsScroll: {
    gap: 6,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabPillText: {
    fontSize: 12,
  },
  tabSection: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  formRow: {
    marginTop: 12,
  },
  formLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputBox: {
    borderWidth: 1,
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  tabsBar: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 52,
    borderRadius: 9,
    paddingHorizontal: 2,
  },
  tabBtnActive: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#5B3DF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
  },
  formMsg: {
    fontSize: 13,
    marginBottom: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  profileLabel: {
    fontSize: 12.5,
  },
  profileVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 6,
  },
  switchLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  subLabel: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dayPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  dayPillText: {
    fontSize: 11.5,
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  staffName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  staffPhone: {
    fontSize: 11.5,
    marginTop: 1,
  },
  emptyText: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  exportBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  exportBtnSub: {
    fontSize: 11,
    marginTop: 1,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  serverUrlText: {
    fontSize: 11,
    marginTop: 2,
  },
  btnLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 4,
  },
  btnLogoutText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
  },
});

// the web's Settings cards (st-*) on a phone
const ws = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  headSub: { fontSize: 13 },
  h1: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },
  outline: { minHeight: 36, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  outlineText: { fontSize: 13.5, fontWeight: '500' },
  chip: { height: 30, paddingHorizontal: 12, borderRadius: 99, justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  pad: { padding: 16 },
  padX: { paddingHorizontal: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  cardIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15.5, fontWeight: '700', marginBottom: 8 },
  cardSub: { fontSize: 13, marginTop: 1, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 6 },
  input: { height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 15, marginBottom: 4 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 12 },
  msg: { fontSize: 13, marginTop: 6 },
  primary: { height: 44, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, marginBottom: 16 },
  primaryText: { color: '#fff', fontSize: 14.5, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 18, borderTopWidth: 1 },
  rowIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12.5, marginTop: 1, lineHeight: 17 },
  go: { fontSize: 13, fontWeight: '600' },
  seg: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 10 },
  segBtn: { height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  waPreview: { marginTop: 12, padding: 12, borderRadius: 12 },
  waBubble: { maxWidth: '86%', alignSelf: 'flex-end', paddingVertical: 9, paddingHorizontal: 11, borderRadius: 10, borderBottomRightRadius: 2 },
  outletAv: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  staff: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1 },
  downloads: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
  dl: { width: '48%', flexGrow: 1, padding: 12, borderRadius: 12, borderWidth: 1, gap: 2 },
  dlTitle: { fontSize: 13.5, fontWeight: '600' },
  dlSub: { fontSize: 12 },
  danger: { borderWidth: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, marginBottom: 14 },
});
