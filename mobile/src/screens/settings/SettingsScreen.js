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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, getApiBaseUrl, setApiBaseUrl } from '../../api/api';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';

export default function SettingsScreen() {
  const { logout, userId } = useAuth();
  const { biz, isOwner, updateBusiness } = useBiz();
  const { theme, isDark, toggleTheme } = useTheme();

  // UPI Form
  const [upiId, setUpiId] = useState(biz?.upiId || '');
  const [upiSaving, setUpiSaving] = useState(false);

  // Notifications Form
  const [autoRemind, setAutoRemind] = useState(biz?.notifications?.renewalReminders !== false);
  const [reminderDays, setReminderDays] = useState(biz?.reminderEveryDays || 3);
  const [notifSaving, setNotifSaving] = useState(false);

  // Staff Form & List
  const [staffList, setStaffList] = useState([]);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [staffPhone, setStaffPhone] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');

  // Server URL
  const [serverUrl, setServerUrl] = useState('');
  const [serverModalOpen, setServerModalOpen] = useState(false);

  useEffect(() => {
    if (biz) {
      setUpiId(biz.upiId || '');
      setAutoRemind(biz.notifications?.renewalReminders !== false);
      setReminderDays(biz.reminderEveryDays || 3);

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

  const handleSaveNotifications = async (newAuto, newDays) => {
    setNotifSaving(true);
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
    } finally {
      setNotifSaving(false);
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: theme.colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Settings & Preferences</Text>
          <Text style={[styles.headerSub, { color: theme.colors.textSecondary }]}>
            UPI gateway, staff accounts & app preferences
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Workspace Summary */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Workspace Profile</Text>
          <View style={styles.profileRow}>
            <Text style={[styles.profileLabel, { color: theme.colors.textSecondary }]}>Name:</Text>
            <Text style={[styles.profileVal, { color: theme.colors.text }]}>{biz?.name}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={[styles.profileLabel, { color: theme.colors.textSecondary }]}>Category:</Text>
            <Text style={[styles.profileVal, { color: theme.colors.text }]}>{biz?.type?.toUpperCase()}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={[styles.profileLabel, { color: theme.colors.textSecondary }]}>Your Role:</Text>
            <Badge label={isOwner ? 'Workspace Owner' : 'Staff Member'} variant={isOwner ? 'success' : 'info'} size="sm" />
          </View>
        </Card>

        {/* UPI Gateway (Owner Only) */}
        {isOwner && (
          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>UPI Payment Gateway</Text>
            <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
              Set your UPI VPA ID. Member WhatsApp reminders and statement pages will embed direct tap-to-pay links.
            </Text>

            <Input
              value={upiId}
              onChangeText={setUpiId}
              placeholder="e.g. yourname@okaxis / 9876543210@paytm"
              icon={<Icon name="qr-code-outline" size={18} />}
              style={{ marginTop: 10, marginBottom: 8 }}
            />

            <Button
              title="Save UPI ID"
              variant="primary"
              size="sm"
              loading={upiSaving}
              onPress={handleSaveUpi}
            />
          </Card>
        )}

        {/* Notification Preferences */}
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

          <Text style={[styles.subLabel, { color: theme.colors.textSecondary, marginTop: 10 }]}>
            Reminder Spacing (Prevents spamming members):
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
                      { color: sel ? theme.colors.primaryDark : theme.colors.textSecondary, fontWeight: sel ? '700' : '500' },
                    ]}>
                    Every {days} Days
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Staff Management (Owner only) */}
        {isOwner && (
          <Card style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Staff Logins</Text>
                <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                  Staff can manage members & collect dues
                </Text>
              </View>
              <Button
                title="Add Staff"
                variant="outline"
                size="sm"
                icon={<Icon name="add" size={14} color={theme.colors.text} />}
                onPress={() => {
                  setStaffError('');
                  setAddStaffOpen(true);
                }}
              />
            </View>

            <View style={{ gap: 8, marginTop: 10 }}>
              {staffList.map((s) => (
                <View
                  key={s._id}
                  style={[
                    styles.staffItem,
                    { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.borderSubtle },
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
        )}

        {/* Appearance & Server Configuration */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>App & System Settings</Text>

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
        <Button
          title="Sign Out"
          variant="danger"
          size="lg"
          icon={<Icon name="log-out-outline" size={18} color="#FFFFFF" />}
          onPress={handleSignOut}
          style={{ marginTop: 10, marginBottom: 20 }}
        />
      </ScrollView>

      {/* Add Staff Modal */}
      <Modal
        visible={addStaffOpen}
        onClose={() => setAddStaffOpen(false)}
        title="Add Staff Member"
        subtitle="Invite staff by phone number">
        <View>
          {staffError ? (
            <Text style={[styles.errorText, { color: theme.colors.danger }]}>{staffError}</Text>
          ) : null}
          <Input
            label="Staff Name"
            value={staffName}
            onChangeText={setStaffName}
            placeholder="e.g. Vikas Trainer"
            icon={<Icon name="person-outline" size={18} />}
          />
          <Input
            label="Phone Number *"
            value={staffPhone}
            onChangeText={setStaffPhone}
            placeholder="e.g. 9876543210"
            keyboardType="phone-pad"
            icon={<Icon name="call-outline" size={18} />}
          />
          <Button
            title="Grant Staff Access"
            variant="primary"
            loading={staffLoading}
            onPress={handleAddStaff}
            style={{ marginTop: 8 }}
          />
        </View>
      </Modal>

      {/* Edit Server URL Modal */}
      <Modal
        visible={serverModalOpen}
        onClose={() => setServerModalOpen(false)}
        title="Server API URL"
        subtitle="Configure backend endpoint">
        <View>
          <Input
            label="Base URL"
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://10.0.2.2:4000/api"
            hint="For Android emulator use 10.0.2.2; for real phones use your computer's LAN IP"
          />
          <Button
            title="Save URL"
            variant="primary"
            onPress={handleSaveServer}
            style={{ marginTop: 8 }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  subLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 6,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayPill: {
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dayPillText: {
    fontSize: 12,
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
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
    textAlign: 'center',
    paddingVertical: 12,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
  },
  serverUrlText: {
    fontSize: 11,
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
});

