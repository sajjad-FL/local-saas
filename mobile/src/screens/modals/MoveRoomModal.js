import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, formatDate } from '../../api/api';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

const natural = (a, b) =>
  String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

export default function MoveRoomModal({
  visible,
  member,
  biz,
  currentRent,
  onClose,
  onMoved,
}) {
  const { theme } = useTheme();

  const [rooms, setRooms] = useState([]);
  const [groups, setGroups] = useState([]);
  const [buildingId, setBuildingId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [rent, setRent] = useState('');
  const [onDate, setOnDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentRoomId = String(member?.roomId?._id || member?.roomId || '');

  useEffect(() => {
    if (visible && biz?._id) {
      setRoomId('');
      setRent(currentRent != null ? String(currentRent) : '');
      setOnDate(new Date().toISOString().slice(0, 10));
      setError('');

      (async () => {
        try {
          const [rList, gList] = await Promise.all([
            api(`/businesses/${biz._id}/rooms`),
            api(`/businesses/${biz._id}/groups`),
          ]);
          const sortedG = Array.isArray(gList) ? [...gList].sort((a, b) => natural(a.name, b.name)) : [];
          setGroups(sortedG);
          const rArr = Array.isArray(rList) ? rList : [];
          setRooms(rArr);

          const currentR = rArr.find((r) => r._id === currentRoomId);
          const currentBId = currentR?.groupId?._id || currentR?.groupId || sortedG[0]?._id || '';
          setBuildingId(String(currentBId));
        } catch (err) {
          console.warn('Error fetching rooms for move', err);
        }
      })();
    }
  }, [visible, biz?._id, currentRent, currentRoomId]);

  if (!visible || !member) return null;

  const currentRoom = rooms.find((r) => r._id === currentRoomId);
  const targetRoom = rooms.find((r) => r._id === roomId);

  const buildingOf = (r) => String(r.groupId?._id || r.groupId || '');
  const filteredRooms = rooms.filter((r) => {
    if (groups.length > 0 && buildingId) {
      return buildingOf(r) === buildingId;
    }
    return true;
  }).sort((a, b) => natural(a.roomNo, b.roomNo));

  const rentNumber = rent === '' ? null : Number(rent);
  const rentChanged = rentNumber !== null && rentNumber !== currentRent;

  const handleMove = async () => {
    if (!roomId) {
      setError('Please select a target room');
      return;
    }
    if (rent !== '' && (!Number.isInteger(rentNumber) || rentNumber < 1)) {
      setError('Rent must be a positive whole number');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api(`/members/${member._id}/move`, {
        method: 'POST',
        body: {
          roomId,
          on: onDate,
          rent: rentChanged ? rentNumber : null,
        },
      });
      if (onMoved) onMoved();
    } catch (err) {
      setError(err.message || 'Failed to move room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={`Move ${member.name}`}
      subtitle="Transfer tenant to another room & update rent">
      <ScrollView showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: theme.colors.dangerSoft }]}>
            <Text style={[styles.errorText, { color: theme.colors.dangerDark }]}>{error}</Text>
          </View>
        ) : null}

        {/* Current vs Target Room Banner */}
        <View
          style={[
            styles.transferBanner,
            { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.borderSubtle },
          ]}>
          <View style={styles.roomCol}>
            <Text style={[styles.roomColLabel, { color: theme.colors.textMuted }]}>Now in</Text>
            <Text style={[styles.roomColVal, { color: theme.colors.text }]}>
              {currentRoom ? `Room ${currentRoom.roomNo}` : 'No room'}
            </Text>
          </View>

          <Icon name="arrow-forward" size={18} color={theme.colors.primary} />

          <View style={styles.roomCol}>
            <Text style={[styles.roomColLabel, { color: theme.colors.textMuted }]}>Moving to</Text>
            <Text
              style={[
                styles.roomColVal,
                { color: targetRoom ? theme.colors.primaryDark : theme.colors.textSecondary },
              ]}>
              {targetRoom ? `Room ${targetRoom.roomNo}` : 'Select below'}
            </Text>
          </View>
        </View>

        {/* Building Tabs (if multiple buildings) */}
        {groups.length > 1 && (
          <View style={styles.buildingRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {groups.map((g) => {
                const active = buildingId === g._id;
                return (
                  <TouchableOpacity
                    key={g._id}
                    onPress={() => {
                      setBuildingId(g._id);
                      setRoomId('');
                    }}
                    style={[
                      styles.buildingTab,
                      {
                        backgroundColor: active ? theme.colors.primarySoft : theme.colors.cardSubtle,
                        borderColor: active ? theme.colors.primary : theme.colors.borderSubtle,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.buildingTabText,
                        { color: active ? theme.colors.primaryDark : theme.colors.textSecondary },
                      ]}>
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Rooms Grid */}
        <Text style={[styles.sectionLabel, { color: theme.colors.text, marginTop: 12 }]}>
          Available Rooms
        </Text>
        <View style={styles.roomGrid}>
          {filteredRooms.map((r) => {
            const occupied = r.occupied || 0;
            const free = Math.max(0, r.capacity - occupied);
            const isCurrent = r._id === currentRoomId;
            const isSelected = r._id === roomId;
            const disabled = isCurrent || free === 0;

            return (
              <TouchableOpacity
                key={r._id}
                disabled={disabled}
                onPress={() => {
                  setRoomId(r._id);
                  setError('');
                }}
                style={[
                  styles.roomTile,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primarySoft
                      : isCurrent
                      ? theme.colors.cardSubtle
                      : free === 0
                      ? theme.colors.cardSubtle
                      : theme.colors.card,
                    borderColor: isSelected
                      ? theme.colors.primary
                      : isCurrent
                      ? theme.colors.borderSubtle
                      : theme.colors.border,
                    opacity: disabled && !isCurrent ? 0.5 : 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.roomNo,
                    { color: isSelected ? theme.colors.primaryDark : theme.colors.text },
                  ]}>
                  Room {r.roomNo}
                </Text>

                <Text style={[styles.roomCapacity, { color: theme.colors.textMuted }]}>
                  {isCurrent
                    ? 'Current Room'
                    : free === 0
                    ? 'Full'
                    : `${free} bed${free > 1 ? 's' : ''} free`}
                </Text>

                {r.bedRent != null && !isCurrent && free > 0 && (
                  <Text style={[styles.roomRent, { color: theme.colors.primaryDark }]}>
                    {rupees(r.bedRent)}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Move Options (When a room is selected) */}
        {targetRoom && (
          <View style={[styles.detailsSection, { borderTopColor: theme.colors.borderSubtle }]}>
            <Input
              label="Rent From Now On (₹)"
              placeholder="e.g. 7000"
              keyboardType="numeric"
              value={rent}
              onChangeText={setRent}
              icon={<Icon name="cash-outline" size={18} />}
            />

            {targetRoom.bedRent != null && targetRoom.bedRent !== rentNumber && (
              <TouchableOpacity
                onPress={() => setRent(String(targetRoom.bedRent))}
                style={styles.resetRentBtn}>
                <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '600' }}>
                  Use Room {targetRoom.roomNo}'s default rent: {rupees(targetRoom.bedRent)}
                </Text>
              </TouchableOpacity>
            )}

            <Input
              label="Moving Date"
              placeholder="YYYY-MM-DD"
              value={onDate}
              onChangeText={setOnDate}
              icon={<Icon name="calendar-outline" size={18} />}
            />

            <Text style={[styles.rentHint, { color: theme.colors.textSecondary }]}>
              {rentChanged
                ? 'The new rent applies from their next bill. Bills already raised stay as they are.'
                : 'Their rent stays the same.'}
            </Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <Button
            title={loading ? 'Moving…' : targetRoom ? `Move to Room ${targetRoom.roomNo}` : 'Move'}
            variant="primary"
            loading={loading}
            disabled={!targetRoom || loading}
            onPress={handleMove}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  transferBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  roomCol: {
    alignItems: 'center',
  },
  roomColLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  roomColVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  buildingRow: {
    marginBottom: 8,
  },
  buildingTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  buildingTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  roomTile: {
    width: '48%',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  roomNo: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  roomCapacity: {
    fontSize: 11.5,
    marginTop: 2,
  },
  roomRent: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 3,
  },
  detailsSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  resetRentBtn: {
    marginTop: -6,
    marginBottom: 10,
  },
  rentHint: {
    fontSize: 11.5,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingBottom: 10,
  },
});

