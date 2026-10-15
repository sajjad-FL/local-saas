import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees } from '../../api/api';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

export default function AddMemberModal({
  visible,
  biz,
  onClose,
  onMemberAdded,
}) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [planId, setPlanId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const [plans, setPlans] = useState([]);
  const [groups, setGroups] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && biz?._id) {
      setName('');
      setPhone('');
      setPlanId('');
      setGroupId('');
      setRoomId('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setError('');

      // Fetch plans, groups, and rooms
      (async () => {
        try {
          const [p, g] = await Promise.all([
            api(`/businesses/${biz._id}/plans`),
            api(`/businesses/${biz._id}/groups`),
          ]);
          setPlans(Array.isArray(p) ? p : []);
          setGroups(Array.isArray(g) ? g : []);
          if (p?.length > 0) setPlanId(p[0]._id);

          if (biz.type === 'hostel') {
            const r = await api(`/businesses/${biz._id}/rooms`);
            setRooms(Array.isArray(r) ? r : []);
          }
        } catch (err) {
          console.warn('Error loading form options', err);
        }
      })();
    }
  }, [visible, biz]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Member name is required');
      return;
    }
    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const member = await api(`/businesses/${biz._id}/members`, {
        method: 'POST',
        body: {
          name: name.trim(),
          phone: phone.trim(),
          groupId: groupId || undefined,
          roomId: roomId || undefined,
          joinDate: startDate,
        },
      });

      // Subscribe to selected plan if chosen
      if (planId && member?._id) {
        await api(`/members/${member._id}/subscribe`, {
          method: 'POST',
          body: {
            planId,
            startDate,
          },
        });
      }

      if (onMemberAdded) {
        onMemberAdded(member);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Add New Member"
      subtitle={`Register new member in ${biz?.name || 'Workspace'}`}>
      <View>
        {error ? (
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
        ) : null}

        <Input
          label="Full Name *"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Rahul Sharma"
          icon={<Icon name="person-outline" size={18} />}
        />

        <Input
          label="Phone Number *"
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 9876543210"
          keyboardType="phone-pad"
          icon={<Icon name="call-outline" size={18} />}
        />

        <Input
          label="Join / Start Date (YYYY-MM-DD)"
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          icon={<Icon name="calendar-outline" size={18} />}
        />

        {/* Membership Plan Selection */}
        {plans.length > 0 && (
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Membership Plan</Text>
            <View style={styles.optionGrid}>
              {plans.map((p) => {
                const selected = planId === p._id;
                return (
                  <TouchableOpacity
                    key={p._id}
                    activeOpacity={0.7}
                    onPress={() => setPlanId(selected ? '' : p._id)}
                    style={[
                      styles.optionCard,
                      {
                        backgroundColor: selected ? theme.colors.primarySoft : theme.colors.cardSubtle,
                        borderColor: selected ? theme.colors.primary : theme.colors.borderSubtle,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.optionTitle,
                        { color: selected ? theme.colors.primaryDark : theme.colors.text },
                      ]}>
                      {p.name}
                    </Text>
                    <Text style={[styles.optionPrice, { color: theme.colors.primary }]}>
                      {rupees(p.amount)} · {p.cycleDays}d
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Group / Batch Selection */}
        {groups.length > 0 && (
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
              {biz.type === 'gym' ? 'Workout Batch / Slot' : biz.type === 'tuition' ? 'Class Batch' : 'Batch / Shift'}
            </Text>
            <View style={styles.chipRow}>
              {groups.map((g) => {
                const selected = groupId === g._id;
                return (
                  <TouchableOpacity
                    key={g._id}
                    activeOpacity={0.7}
                    onPress={() => setGroupId(selected ? '' : g._id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? theme.colors.infoSoft : theme.colors.cardSubtle,
                        borderColor: selected ? theme.colors.info : theme.colors.borderSubtle,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? theme.colors.infoDark : theme.colors.textSecondary },
                      ]}>
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Room Selection (Hostel only) */}
        {biz.type === 'hostel' && rooms.length > 0 && (
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Hostel Room</Text>
            <View style={styles.chipRow}>
              {rooms.map((r) => {
                const selected = roomId === r._id;
                return (
                  <TouchableOpacity
                    key={r._id}
                    activeOpacity={0.7}
                    onPress={() => setRoomId(selected ? '' : r._id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? theme.colors.successSoft : theme.colors.cardSubtle,
                        borderColor: selected ? theme.colors.success : theme.colors.borderSubtle,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? theme.colors.successDark : theme.colors.textSecondary },
                      ]}>
                      Room {r.roomNo} ({r.capacity} beds)
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <Button
          title="Add Member & Subscribe"
          variant="primary"
          loading={loading}
          onPress={handleSubmit}
          style={{ marginTop: 10 }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  errorText: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  sectionWrap: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionCard: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    width: '48%',
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionPrice: {
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

