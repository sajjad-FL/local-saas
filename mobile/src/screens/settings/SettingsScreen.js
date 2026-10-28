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
  Linking,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, getApiBaseUrl, setApiBaseUrl, STORAGE_KEYS } from '../../api/api';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import { downloadFile } from '../../api/download';
import { BIZ_CONFIG } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TABS = [
  { key: 'profile', label: 'Profile', icon: 'person-outline', intro: 'Your name, phone number and password.' },
  { key: 'payments', label: 'Payments', icon: 'shield-checkmark-outline', intro: 'How members pay you, and how they are reminded.' },
  { key: 'team', label: 'Team', icon: 'people-outline', intro: 'People who can help you run the business.', ownerOnly: true },
  { key: 'business', label: 'Business', icon: 'business-outline', intro: 'Your business details and the features you use.' },
  { key: 'data', label: 'Backup', icon: 'download-outline', intro: 'Download your data for accounting or safekeeping.' },
];

export default function SettingsScreen({ navigation }) {
  const { logout, user } = useAuth();
  const { biz, isOwner, updateBusiness, refetch } = useBiz();
  const { theme, isDark, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState('profile');

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

  const tabs = TABS.filter((t) => !t.ownerOnly || isOwner);
  const currentTabObj = tabs.find((t) => t.key === activeTab) || tabs[0];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* TopBar */}
      <TopBar navigation={navigation} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: theme.colors.text }]}>Settings</Text>
          <Text style={[styles.pageSubtitle, { color: theme.colors.textSecondary }]}>
            {currentTabObj.intro}
          </Text>
        </View>

        {/* Setup Shortcut Banner */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Setup')}
          style={[styles.shortcutBanner, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={[styles.shortcutIconWrap, { backgroundColor: 'rgba(139, 92, 246, 0.14)' }]}>
            <Icon name="options-outline" size={18} color="#8B5CF6" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.shortcutTitle, { color: theme.colors.text }]}>
              Plans, batches & rooms
            </Text>
            <Text style={[styles.shortcutSub, { color: theme.colors.textSecondary }]}>
              Fees, cycles, groups, buildings & rooms
            </Text>
          </View>
          <Icon name="chevron-forward" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>

        {/* Tabs: equal widths, icon above the label (same as the web on phones) */}
        <View style={[styles.tabsBar, { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border }]}>
          {tabs.map((t) => {
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveTab(t.key)}
                style={[styles.tabBtn, active && { backgroundColor: theme.colors.card, ...styles.tabBtnActive }]}>
                <Icon name={t.icon} size={16} color={active ? theme.colors.primary : theme.colors.textMuted} />
                <Text style={[styles.tabBtnText, { color: active ? theme.colors.text : theme.colors.textMuted }]} numberOfLines={1}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ============================================================ */}
        {/* TAB 1: PROFILE */}
        {/* ============================================================ */}
        {activeTab === 'profile' && (
          <View style={styles.tabSection}>
            <Card style={styles.card}>
              <View style={[styles.profileHero, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{initials(userName || me?.name)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.profileName, { color: theme.colors.text }]} numberOfLines={1}>{me?.name || 'Your profile'}</Text>
                  <Text style={[styles.cardSub, { color: theme.colors.textMuted, marginBottom: 0 }]}>
                    {me?.phone ? `+91 ${me.phone}` : ''}{me?.role === 'admin' ? ' · platform admin' : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.formRow}>
                <Text style={[styles.formLabel, { color: theme.colors.textSecondary }]}>Your name</Text>
                <TextInput
                  value={userName}
                  onChangeText={(v) => { setUserName(v); setProfileMsg(''); }}
                  maxLength={60}
                  placeholder="Your name"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.inputBox, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder, color: theme.colors.text }]}
                />
              </View>

              <View style={styles.formRow}>
                <Text style={[styles.formLabel, { color: theme.colors.textSecondary }]}>Mobile number (you sign in with this)</Text>
                <TextInput
                  value={userPhone}
                  onChangeText={(v) => { setUserPhone(v.replace(/\D/g, '').slice(0, 10)); setProfileMsg(''); }}
                  keyboardType="number-pad"
                  placeholder="10-digit number"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.inputBox, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder, color: theme.colors.text }]}
                />
              </View>

              {phoneChanged && (
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: theme.colors.textSecondary }]}>Current password (needed to change your number)</Text>
                  <TextInput
                    value={phonePassword}
                    onChangeText={setPhonePassword}
                    secureTextEntry
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.inputBox, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder, color: theme.colors.text }]}
                  />
                </View>
              )}

              {!!profileError && <Text style={[styles.formMsg, { color: theme.colors.danger }]}>{profileError}</Text>}
              {!!profileMsg && <Text style={[styles.formMsg, { color: theme.colors.primary }]}>✓ {profileMsg}</Text>}

              <Button
                title={profileBusy ? 'Saving…' : 'Save changes'}
                icon={<Icon name="checkmark" size={15} color="#FFFFFF" />}
                disabled={!profileChanged || profileBusy || !userName.trim() || userPhone.length !== 10 || (phoneChanged && !phonePassword)}
                onPress={handleSaveProfile}
                style={{ marginTop: 6 }}
              />
            </Card>

            <Card style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Icon name="shield-outline" size={17} color={theme.colors.info} />
                <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>Change password</Text>
              </View>
              <Text style={[styles.cardSub, { color: theme.colors.textMuted }]}>
                At least 6 characters. You stay signed in on this device.
              </Text>
              {[
                ['Current password', currentPassword, setCurrentPassword],
                ['New password', newPassword, setNewPassword],
                ['New password again', newPasswordAgain, setNewPasswordAgain],
              ].map(([label, value, set]) => (
                <View key={label} style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
                  <TextInput
                    value={value}
                    onChangeText={(v) => { set(v); setPwdMsg(''); }}
                    secureTextEntry
                    style={[styles.inputBox, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder, color: theme.colors.text }]}
                  />
                </View>
              ))}
              {!!newPasswordAgain && newPassword !== newPasswordAgain && (
                <Text style={[styles.formMsg, { color: theme.colors.danger }]}>The two new passwords don't match.</Text>
              )}
              {!!pwdError && <Text style={[styles.formMsg, { color: theme.colors.danger }]}>{pwdError}</Text>}
              {!!pwdMsg && <Text style={[styles.formMsg, { color: theme.colors.primary }]}>✓ {pwdMsg}</Text>}
              <Button
                title={pwdLoading ? 'Saving…' : 'Change password'}
                icon={<Icon name="checkmark" size={15} color="#FFFFFF" />}
                disabled={pwdLoading || !currentPassword || newPassword.length < 6 || newPassword !== newPasswordAgain}
                onPress={handleChangePassword}
                style={{ marginTop: 6 }}
              />
            </Card>
          </View>
        )}

        {/* ============================================================ */}
        {/* TAB 2: PAYMENTS */}
        {/* ============================================================ */}
        {activeTab === 'payments' && (
          <View style={styles.tabSection}>
            {isOwner ? (
              <Card style={styles.card}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>UPI Payment Gateway</Text>
                <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                  Set your UPI VPA ID. Member WhatsApp reminders and statement pages will embed direct tap-to-pay links.
                </Text>

                <TextInput
                  value={upiId}
                  onChangeText={setUpiId}
                  placeholder="e.g. yourname@okaxis / 9876543210@paytm"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.inputBox, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder, color: theme.colors.text, marginTop: 10, marginBottom: 12 }]}
                />

                <Button
                  title={upiSaving ? 'Saving…' : 'Save UPI ID'}
                  variant="primary"
                  size="sm"
                  loading={upiSaving}
                  onPress={handleSaveUpi}
                />
              </Card>
            ) : (
              <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginBottom: 12 }}>
                Only the owner can modify UPI settings.
              </Text>
            )}

            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>WhatsApp Reminders</Text>
              <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                Configure automated daily payment reminder frequency
              </Text>

              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: theme.colors.text }]}>
                  Automated Member Reminders
                </Text>
                <Switch
                  value={autoRemind}
                  onValueChange={(val) => handleSaveNotifications(val, reminderDays)}
                  trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.primary }}
                />
              </View>

              <Text style={[styles.subLabel, { color: theme.colors.textSecondary, marginTop: 12 }]}>
                Reminder Spacing:
              </Text>
              <View style={styles.daysRow}>
                {[3, 5, 7].map((days) => {
                  const sel = reminderDays === days;
                  return (
                    <TouchableOpacity
                      key={days}
                      onPress={() => handleSaveNotifications(autoRemind, days)}
                      style={[
                        styles.dayPill,
                        {
                          backgroundColor: sel ? theme.colors.primarySoft : theme.colors.cardSubtle,
                          borderColor: sel ? theme.colors.primary : theme.colors.borderSubtle,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.dayPillText,
                          {
                            color: sel ? theme.colors.primaryDark : theme.colors.textSecondary,
                            fontWeight: sel ? '700' : '500',
                          },
                        ]}>
                        Every {days} Days
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>
          </View>
        )}

        {/* ============================================================ */}
        {/* TAB 3: TEAM */}
        {/* ============================================================ */}
        {activeTab === 'team' && isOwner && (
          <View style={styles.tabSection}>
            <Card style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Staff Logins</Text>
                  <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                    Staff can view members & record payments
                  </Text>
                </View>
                <Button
                  title="Add Staff"
                  variant="primary"
                  size="sm"
                  icon={<Icon name="add" size={14} color="#FFFFFF" />}
                  onPress={() => {
                    setStaffError('');
                    setAddStaffOpen(true);
                  }}
                />
              </View>

              <View style={{ gap: 8, marginTop: 12 }}>
                {staffList.map((s) => (
                  <View
                    key={s._id}
                    style={[
                      styles.staffItem,
                      { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border },
                    ]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.staffName, { color: theme.colors.text }]}>
                        {s.name || 'Staff Member'}
                      </Text>
                      <Text style={[styles.staffPhone, { color: theme.colors.textSecondary }]}>
                        {s.phone}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveStaff(s._id)} style={{ padding: 6 }}>
                      <Icon name="trash-outline" size={16} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}

                {staffList.length === 0 && (
                  <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                    No staff members added. Staff cannot modify your UPI ID or delete transactions.
                  </Text>
                )}
              </View>
            </Card>
          </View>
        )}

        {/* ============================================================ */}
        {/* TAB 4: BUSINESS */}
        {/* ============================================================ */}
        {activeTab === 'business' && (
          <View style={styles.tabSection}>
            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Business Profile</Text>
              <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                The business this account manages
              </Text>

              <View style={styles.formRow}>
                <Text style={[styles.formLabel, { color: theme.colors.textSecondary }]}>Business Name</Text>
                <TextInput
                  value={bizName}
                  onChangeText={setBizName}
                  editable={isOwner}
                  placeholder="Business Name"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.inputBox, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder, color: theme.colors.text }]}
                />
                {isOwner && (
                  <Button
                    title={bizSaving ? 'Saving…' : 'Save Name'}
                    variant="outline"
                    size="sm"
                    loading={bizSaving}
                    style={{ alignSelf: 'flex-start', marginTop: 8 }}
                    onPress={handleSaveBizName}
                  />
                )}
              </View>

              <View style={styles.profileRow}>
                <Text style={[styles.profileLabel, { color: theme.colors.textSecondary }]}>Type:</Text>
                <Text style={[styles.profileVal, { color: theme.colors.text }]}>{BIZ_CONFIG[biz?.type]?.label || biz?.type}</Text>
              </View>

              <View style={styles.profileRow}>
                <Text style={[styles.profileLabel, { color: theme.colors.textSecondary }]}>Your role:</Text>
                <View style={[styles.rolePill, { backgroundColor: theme.colors.primarySoft }]}>
                  <Text style={[styles.rolePillText, { color: theme.colors.primaryDark }]}>{isOwner ? 'Owner' : 'Staff member'}</Text>
                </View>
              </View>

              <View style={styles.profileRow}>
                <Text style={[styles.profileLabel, { color: theme.colors.textSecondary }]}>Workspace ID:</Text>
                <Text style={[styles.profileVal, { color: theme.colors.textSecondary, fontFamily: 'monospace', fontSize: 11 }]}>
                  {biz?._id}
                </Text>
              </View>
            </Card>

            {isOwner && (
              <Card style={styles.card}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Attendance Tracking</Text>
                <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                  Enable daily attendance lists and check-ins
                </Text>

                <View style={[styles.switchRow, { marginTop: 10 }]}>
                  <Text style={[styles.switchLabel, { color: theme.colors.text }]}>
                    Enable Attendance Feature
                  </Text>
                  <Switch
                    value={attendanceEnabled}
                    onValueChange={handleToggleAttendance}
                    trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.primary }}
                  />
                </View>
              </Card>
            )}

            {isOwner && (
              <View style={[styles.dangerCard, { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.danger }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Icon name="alert-circle-outline" size={18} color={theme.colors.danger} />
                  <Text style={[styles.cardTitle, { color: theme.colors.danger, marginBottom: 0 }]}>Danger Zone</Text>
                </View>
                <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                  Irreversible actions for {biz?.name}. Please exercise extreme caution.
                </Text>

                {[
                  { kind: 'clear', title: 'Clear all member data', sub: 'Permanently purge all members, payment transactions, dues, and subscription logs.', btn: 'Clear All Data' },
                  { kind: 'delete', title: 'Delete workspace', sub: 'Permanently delete this entire business workspace and all related configurations.', btn: 'Delete Workspace' },
                ].map((d) => (
                  <View key={d.kind} style={[styles.dangerRow, { borderTopColor: theme.colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dangerTitle, { color: theme.colors.text }]}>{d.title}</Text>
                      <Text style={[styles.dangerSub, { color: theme.colors.textSecondary }]}>{d.sub}</Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => openDanger(d.kind)}
                      style={[styles.dangerBtn, { backgroundColor: theme.colors.danger }]}>
                      <Text style={styles.dangerBtnText}>{d.btn}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ============================================================ */}
        {/* TAB 5: BACKUP & DATA */}
        {/* ============================================================ */}
        {activeTab === 'data' && (
          <View style={styles.tabSection}>
            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Data Backup & Export</Text>
              <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                Spreadsheets open in Excel or Google Sheets
              </Text>

              <View style={{ gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.exportBtn, { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border }]}
                  disabled={Boolean(downloading)}
                  onPress={() => handleDownload('payments', 'export/payments.csv', `${biz.name}-payments-backup.csv`)}>
                  <Icon name="document-text-outline" size={16} color={theme.colors.primary} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.exportBtnTitle, { color: theme.colors.text }]}>Payments Backup</Text>
                    <Text style={[styles.exportBtnSub, { color: theme.colors.textSecondary }]}>Every payment received (CSV)</Text>
                  </View>
                  <Icon name="download-outline" size={15} color={theme.colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.exportBtn, { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border }]}
                  disabled={Boolean(downloading)}
                  onPress={() => handleDownload('balances', 'export/balances.csv', `${biz.name}-balances-backup.csv`)}>
                  <Icon name="stats-chart-outline" size={16} color={theme.colors.primary} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.exportBtnTitle, { color: theme.colors.text }]}>Balances Backup</Text>
                    <Text style={[styles.exportBtnSub, { color: theme.colors.textSecondary }]}>What each member owes now (CSV)</Text>
                  </View>
                  <Icon name="download-outline" size={15} color={theme.colors.textMuted} />
                </TouchableOpacity>

                {isOwner && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.exportBtn, { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border }]}
                    disabled={Boolean(downloading)}
                    onPress={() => handleDownload('backup', 'export/backup.json', `${biz.name}-full-backup.json`)}>
                    <Icon name="archive-outline" size={16} color={theme.colors.primary} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.exportBtnTitle, { color: theme.colors.text }]}>Full backup</Text>
                      <Text style={[styles.exportBtnSub, { color: theme.colors.textSecondary }]}>Everything, to restore later (JSON)</Text>
                    </View>
                    <Icon name="download-outline" size={15} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
                {downloading ? (
                  <Text style={[styles.exportBtnSub, { color: theme.colors.textSecondary }]}>Preparing the file…</Text>
                ) : null}
              </View>
            </Card>

            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Theme & Server URL</Text>

              {/* Theme Toggle */}
              <View style={styles.switchRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name={isDark ? 'moon' : 'sunny'} size={18} color={theme.colors.primary} />
                  <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Dark Theme</Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.primary }}
                />
              </View>

              {/* Server Config */}
              <View style={[styles.serverRow, { borderTopColor: theme.colors.borderSubtle }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Server API URL</Text>
                  <Text style={[styles.serverUrlText, { color: theme.colors.textMuted }]} numberOfLines={1}>
                    {serverUrl}
                  </Text>
                </View>
                <Button
                  title="Edit URL"
                  variant="outline"
                  size="sm"
                  onPress={() => setServerModalOpen(true)}
                />
              </View>
            </Card>

            {/* Logout Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.btnLogout, { borderColor: theme.colors.danger }]}
              onPress={handleSignOut}>
              <Icon name="log-out-outline" size={16} color={theme.colors.danger} />
              <Text style={styles.btnLogoutText}>Sign Out from Workspace</Text>
            </TouchableOpacity>
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
    backgroundColor: '#10B981',
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
