import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../api/api';
import { expandRooms } from '../../constants/roomNumbers';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// − 2 beds + (1 to 30; never fewer than the tenants living there)
function BedStepper({ value, min = 1, onChange, theme }) {
  const btn = (d, icon) => {
    const next = value + d;
    const off = next < min || next > 30;
    return (
      <TouchableOpacity
        disabled={off}
        onPress={() => onChange(next)}
        style={[styles.stepBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card, opacity: off ? 0.4 : 1 }]}>
        <Icon name={icon} size={16} color={theme.colors.text} />
      </TouchableOpacity>
    );
  };
  return (
    <View style={styles.stepper}>
      {btn(-1, 'remove')}
      <Text style={[styles.stepValue, { color: theme.colors.text }]}>{plural(value, 'bed')}</Text>
      {btn(1, 'add')}
    </View>
  );
}

function Chips({ options, value, onChange, theme }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.chip, { backgroundColor: on ? theme.colors.primarySoft : theme.colors.card, borderColor: on ? theme.colors.primary : theme.colors.border }]}>
            <Text style={[styles.chipText, { color: on ? theme.colors.primaryDark : theme.colors.textSecondary }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Add one room, or a range like 101-110, to a building's floor (web: Setup's floor form and Rooms' Add room)
export function AddRoomModal({ visible, biz, group, floor, existing = [], onClose, onSaved }) {
  const { theme } = useTheme();
  const [numbers, setNumbers] = useState('');
  const [beds, setBeds] = useState(2);
  const [rent, setRent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) { setNumbers(''); setBeds(2); setRent(''); setError(''); }
  }, [visible]);

  const list = expandRooms(numbers);
  const taken = new Set(existing.filter((r) => String(r.groupId?._id || r.groupId) === group?._id).map((r) => String(r.roomNo).toLowerCase()));
  const clash = list?.find((n) => taken.has(n.toLowerCase()));

  // added one by one, stopping at the first problem
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      for (const roomNo of list) {
        await api(`/businesses/${biz._id}/rooms`, {
          method: 'POST',
          body: { groupId: group?._id, floorId: floor?._id, roomNo, capacity: beds, bedRent: rent === '' ? null : Number(rent) },
        });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Add room" subtitle={`${group?.name || ''}${floor ? ` · ${floor.name}` : ''}`}>
      <Input
        label="Room number, or a range like 101-110"
        value={numbers}
        onChangeText={setNumbers}
        placeholder="e.g. 101"
        icon={<Icon name="enter-outline" size={18} />}
      />
      {clash ? <Text style={[styles.error, { color: theme.colors.danger }]}>Room {clash} already exists in {group?.name}.</Text> : null}
      <Text style={[styles.label, { color: theme.colors.text }]}>Beds in each room</Text>
      <BedStepper value={beds} onChange={setBeds} theme={theme} />
      <Input
        label="Rent per bed (₹, optional)"
        value={rent}
        onChangeText={(v) => setRent(v.replace(/[^\d]/g, ''))}
        placeholder="e.g. 6000"
        keyboardType="numeric"
        icon={<Icon name="cash-outline" size={18} />}
      />
      {error ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        <Button
          title={busy ? 'Adding…' : list === null ? 'Range too big (max 50)' : list.length > 1 ? `Add ${list.length} rooms` : 'Add room'}
          variant="primary"
          disabled={busy || !list?.length || Boolean(clash)}
          onPress={save}
          style={{ flex: 1 }}
        />
      </View>
    </Modal>
  );
}

// Change a room: number, beds, rent, building, floor. The server refuses fewer beds than tenants.
export function EditRoomModal({ visible, biz, room, groups = [], onClose, onSaved }) {
  const { theme } = useTheme();
  const [roomNo, setRoomNo] = useState('');
  const [capacity, setCapacity] = useState(1);
  const [bedRent, setBedRent] = useState('');
  const [groupId, setGroupId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && room) {
      setRoomNo(String(room.roomNo));
      setCapacity(room.capacity);
      setBedRent(room.bedRent != null ? String(room.bedRent) : '');
      setGroupId(String(room.groupId?._id || room.groupId || ''));
      setFloorId(room.floorId || '');
      setError('');
    }
  }, [visible, room]);

  const building = groups.find((g) => g._id === groupId);
  const occupied = room?.occupied || 0;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`/businesses/${biz._id}/rooms/${room._id}`, {
        method: 'PATCH',
        body: { roomNo: roomNo.trim(), capacity, bedRent: bedRent === '' ? null : Number(bedRent), groupId: groupId || null, floorId: floorId || null },
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title={`Edit room ${room?.roomNo ?? ''}`}>
      <Input label="Room number *" value={roomNo} onChangeText={setRoomNo} icon={<Icon name="enter-outline" size={18} />} />
      <Text style={[styles.label, { color: theme.colors.text }]}>Beds *</Text>
      <BedStepper value={capacity} min={Math.max(1, occupied)} onChange={setCapacity} theme={theme} />
      {occupied > 0 && (
        <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
          {plural(occupied, 'tenant')} live{occupied === 1 ? 's' : ''} here now.
        </Text>
      )}
      <Input
        label="Rent per bed (₹, optional)"
        value={bedRent}
        onChangeText={(v) => setBedRent(v.replace(/[^\d]/g, ''))}
        placeholder="e.g. 6000"
        keyboardType="numeric"
        icon={<Icon name="cash-outline" size={18} />}
      />
      <Text style={[styles.label, { color: theme.colors.text }]}>Building</Text>
      <Chips
        theme={theme}
        value={groupId}
        onChange={(v) => { setGroupId(v); setFloorId(''); }}
        options={[{ value: '', label: 'Not in a building' }, ...groups.map((g) => ({ value: g._id, label: g.name }))]}
      />
      {building && (
        <>
          <Text style={[styles.label, { color: theme.colors.text }]}>Floor</Text>
          <Chips
            theme={theme}
            value={floorId}
            onChange={setFloorId}
            options={[{ value: '', label: 'Not on a floor' }, ...(building.floors || []).map((f) => ({ value: f._id, label: f.name }))]}
          />
        </>
      )}
      {error ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        <Button
          title={busy ? 'Saving…' : 'Save changes'}
          variant="primary"
          disabled={busy || !roomNo.trim()}
          onPress={save}
          style={{ flex: 1 }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 12, marginTop: -8, marginBottom: 12 },
  error: { fontSize: 12.5, marginBottom: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  stepBtn: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 15, fontWeight: '700', minWidth: 70, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12.5, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
