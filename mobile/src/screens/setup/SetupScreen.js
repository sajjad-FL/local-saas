import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees } from '../../api/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Icon from '../../components/Icon';

const GROUP_LABELS = {
  mess: { title: 'Meal Shifts & Mess Groups', hint: 'Organize into breakfast, lunch, or dinner shifts', icon: 'restaurant-outline' },
  tuition: { title: 'Batches & Class Slots', hint: 'Categorize students into morning or evening batches', icon: 'school-outline' },
  gym: { title: 'Workout Batches & Slots', hint: 'Organize members into morning or evening workout slots', icon: 'barbell-outline' },
  hostel: { title: 'Properties & Buildings', hint: 'Hostel buildings and properties where rooms reside', icon: 'business-outline' },
};

export default function SetupScreen() {
  const { biz } = useBiz();
  const { theme } = useTheme();

  const [plans, setPlans] = useState([]);
  const [groups, setGroups] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);

  // Forms
  const [planForm, setPlanForm] = useState({ name: '', cycleDays: '30', amount: '' });
  const [groupForm, setGroupForm] = useState({ name: '' });
  const [roomForm, setRoomForm] = useState({ roomNo: '', capacity: '2' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSetupData = useCallback(async () => {
    if (!biz?._id) return;
    try {
      const [p, g] = await Promise.all([
        api(`/businesses/${biz._id}/plans`),
        api(`/businesses/${biz._id}/groups`),
      ]);
      setPlans(Array.isArray(p) ? p : []);
      setGroups(Array.isArray(g) ? g : []);

      if (biz.type === 'hostel') {
        const r = await api(`/businesses/${biz._id}/rooms`);
        setRooms(Array.isArray(r) ? r : []);
      }
    } catch (err) {
      console.warn('Setup fetch error', err);
    }
  }, [biz?._id, biz?.type]);

  useEffect(() => {
    fetchSetupData();
  }, [fetchSetupData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSetupData();
    setRefreshing(false);
  };

  // Create Plan
  const handleCreatePlan = async () => {
    if (!planForm.name.trim()) {
      setError('Plan name is required');
      return;
    }
    const amt = Number(planForm.amount);
    if (!amt || amt <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    const days = Number(planForm.cycleDays);
    if (!days || days <= 0) {
      setError('Cycle days must be at least 1');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api(`/businesses/${biz._id}/plans`, {
        method: 'POST',
        body: {
          name: planForm.name.trim(),
          cycleDays: days,
          amount: amt,
        },
      });
      setPlanModalOpen(false);
      setPlanForm({ name: '', cycleDays: '30', amount: '' });
      await fetchSetupData();
    } catch (err) {
      setError(err.message || 'Failed to create plan');
    } finally {
      setLoading(false);
    }
  };

  // Create Group
  const handleCreateGroup = async () => {
    if (!groupForm.name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api(`/businesses/${biz._id}/groups`, {
        method: 'POST',
        body: { name: groupForm.name.trim() },
      });
      setGroupModalOpen(false);
      setGroupForm({ name: '' });
      await fetchSetupData();
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  // Create Room (Hostel)
  const handleCreateRoom = async () => {
    if (!roomForm.roomNo.trim()) {
      setError('Room number is required');
      return;
    }
    const cap = Number(roomForm.capacity);
    if (!cap || cap <= 0) {
      setError('Capacity must be at least 1 bed');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api(`/businesses/${biz._id}/rooms`, {
        method: 'POST',
        body: {
          roomNo: roomForm.roomNo.trim(),
          capacity: cap,
        },
      });
      setRoomModalOpen(false);
      setRoomForm({ roomNo: '', capacity: '2' });
      await fetchSetupData();
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const groupInfo = GROUP_LABELS[biz?.type] || GROUP_LABELS.gym;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: theme.colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Plans & Workspace Setup</Text>
          <Text style={[styles.headerSub, { color: theme.colors.textSecondary }]}>
            Configure membership packages, workout slots & bed limits
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }>
        {/* SECTION 1: Membership Plans */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Membership Plans</Text>
              <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>
                Billing packages and cycle lengths
              </Text>
            </View>
            <Button
              title="Add Plan"
              variant="primary"
              size="sm"
              icon={<Icon name="add" size={14} color="#FFFFFF" />}
              onPress={() => {
                setError('');
                setPlanModalOpen(true);
              }}
            />
          </View>

          <View style={{ gap: 8, marginTop: 10 }}>
            {plans.map((p) => (
              <View
                key={p._id}
                style={[
                  styles.itemCard,
                  { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.borderSubtle },
                ]}>
                <View style={[styles.itemIconWrap, { backgroundColor: theme.colors.primaryLight }]}>
                  <Icon name="card-outline" size={18} color={theme.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: theme.colors.text }]}>{p.name}</Text>
                  <Text style={[styles.itemSub, { color: theme.colors.textSecondary }]}>
                    {p.cycleDays} days recurring cycle
                  </Text>
                </View>
                <Text style={[styles.itemPrice, { color: theme.colors.primary }]}>
                  {rupees(p.amount)}
                </Text>
              </View>
            ))}

            {plans.length === 0 && (
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                No membership plans created yet. Add packages like "Monthly ₹1,500" or "Quarterly ₹4,000".
              </Text>
            )}
          </View>
        </Card>

        {/* SECTION 2: Groups / Batches / Shifts */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{groupInfo.title}</Text>
              <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>
                {groupInfo.hint}
              </Text>
            </View>
            <Button
              title="Add Slot"
              variant="outline"
              size="sm"
              icon={<Icon name="add" size={14} color={theme.colors.text} />}
              onPress={() => {
                setError('');
                setGroupModalOpen(true);
              }}
            />
          </View>

          <View style={{ gap: 8, marginTop: 10 }}>
            {groups.map((g) => (
              <View
                key={g._id}
                style={[
                  styles.itemCard,
                  { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.borderSubtle },
                ]}>
                <View style={[styles.itemIconWrap, { backgroundColor: '#EDE9FE' }]}>
                  <Icon name={groupInfo.icon} size={18} color="#6D28D9" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: theme.colors.text }]}>{g.name}</Text>
                  <Text style={[styles.itemSub, { color: theme.colors.textSecondary }]}>
                    Active batch slot
                  </Text>
                </View>
              </View>
            ))}

            {groups.length === 0 && (
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                No batches or slots added yet. e.g. "Morning 6 AM - 8 AM"
              </Text>
            )}
          </View>
        </Card>

        {/* SECTION 3: Hostel Rooms (if Hostel) */}
        {biz?.type === 'hostel' && (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Rooms & Bed Capacities</Text>
                <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>
                  Assignments blocked when a room is full
                </Text>
              </View>
              <Button
                title="Add Room"
                variant="outline"
                size="sm"
                icon={<Icon name="add" size={14} color={theme.colors.text} />}
                onPress={() => {
                  setError('');
                  setRoomModalOpen(true);
                }}
              />
            </View>

            <View style={{ gap: 8, marginTop: 10 }}>
              {rooms.map((r) => {
                const isFull = (r.occupied || 0) >= r.capacity;
                return (
                  <View
                    key={r._id}
                    style={[
                      styles.itemCard,
                      { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.borderSubtle },
                    ]}>
                    <View style={[styles.itemIconWrap, { backgroundColor: '#D1FAE5' }]}>
                      <Icon name="bed-outline" size={18} color="#065F46" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: theme.colors.text }]}>
                        Room {r.roomNo}
                      </Text>
                      <Text style={[styles.itemSub, { color: theme.colors.textSecondary }]}>
                        Bed capacity: {r.capacity} beds
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.itemPrice,
                        { color: isFull ? theme.colors.danger : theme.colors.primary },
                      ]}>
                      {isFull ? 'Full' : 'Available'}
                    </Text>
                  </View>
                );
              })}

              {rooms.length === 0 && (
                <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                  No rooms added yet. e.g. "Room 101 (2 Beds)"
                </Text>
              )}
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Plan Modal */}
      <Modal
        visible={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title="Add Membership Plan"
        subtitle="Define package duration and price">
        <View>
          {error ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text> : null}
          <Input
            label="Plan Name *"
            value={planForm.name}
            onChangeText={(v) => setPlanForm({ ...planForm, name: v })}
            placeholder="e.g. Monthly Fitness, Quarterly Standard"
          />
          <Input
            label="Duration (in days) *"
            value={planForm.cycleDays}
            onChangeText={(v) => setPlanForm({ ...planForm, cycleDays: v })}
            placeholder="30"
            keyboardType="numeric"
            hint="Common cycles: 30 (Monthly), 90 (Quarterly), 180 (Half-Yearly), 365 (Yearly)"
          />
          <Input
            label="Fee Amount (₹) *"
            value={planForm.amount}
            onChangeText={(v) => setPlanForm({ ...planForm, amount: v })}
            placeholder="e.g. 1500"
            keyboardType="numeric"
          />
          <Button
            title="Create Plan"
            variant="primary"
            loading={loading}
            onPress={handleCreatePlan}
            style={{ marginTop: 8 }}
          />
        </View>
      </Modal>

      {/* Group Modal */}
      <Modal
        visible={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        title={`Add ${groupInfo.title.split('&')[0].trim()}`}
        subtitle="Categorize members into batches or shifts">
        <View>
          {error ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text> : null}
          <Input
            label="Slot / Batch Name *"
            value={groupForm.name}
            onChangeText={(v) => setGroupForm({ ...groupForm, name: v })}
            placeholder="e.g. Morning 6 AM - 8 AM"
          />
          <Button
            title="Add Batch Slot"
            variant="primary"
            loading={loading}
            onPress={handleCreateGroup}
            style={{ marginTop: 8 }}
          />
        </View>
      </Modal>

      {/* Room Modal */}
      <Modal
        visible={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        title="Add Hostel Room"
        subtitle="Set room identifier and maximum bed capacity">
        <View>
          {error ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text> : null}
          <Input
            label="Room Number / Name *"
            value={roomForm.roomNo}
            onChangeText={(v) => setRoomForm({ ...roomForm, roomNo: v })}
            placeholder="e.g. 101, 102A"
          />
          <Input
            label="Bed Capacity *"
            value={roomForm.capacity}
            onChangeText={(v) => setRoomForm({ ...roomForm, capacity: v })}
            placeholder="2"
            keyboardType="numeric"
            hint="System will automatically prevent assigning members once beds are filled"
          />
          <Button
            title="Add Room"
            variant="primary"
            loading={loading}
            onPress={handleCreateRoom}
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
  sectionCard: {
    padding: 14,
    marginBottom: 12,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
  },
  itemIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  itemSub: {
    fontSize: 11,
    marginTop: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 14,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
});

