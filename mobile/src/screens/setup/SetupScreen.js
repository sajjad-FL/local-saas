import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  TextInput,
} from 'react-native';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees } from '../../api/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import { tint } from '../../constants/theme';
import { words } from '../../constants/wording';
import { copyNumbers } from '../../constants/roomNumbers';
import { AddRoomModal, EditRoomModal } from '../modals/RoomModals';

const natural = (a, b) =>
  String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

// each building gets its own accent, like the web's Setup tree
const ACCENTS = ['#8B5CF6', '#0EA5E9', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1'];
const counts = (list) => {
  const beds = list.reduce((s, r) => s + r.capacity, 0);
  const used = list.reduce((s, r) => s + Math.min(r.occupied || 0, r.capacity), 0);
  return { rooms: list.length, beds, free: beds - used, pct: beds ? Math.round((used / beds) * 100) : 0 };
};
const floorLevel = (name) => {
  const t = String(name).trim().toLowerCase();
  if (/^ground/.test(t)) return 0;
  const m = t.match(/^(\d+)(st|nd|rd|th)?\b/) || t.match(/^(first|second|third|fourth|fifth)\b/);
  if (!m) return null;
  return Number(m[1]) || ['first', 'second', 'third', 'fourth', 'fifth'].indexOf(m[1]) + 1;
};
const floorBadge = (name) => {
  const lvl = floorLevel(name);
  return lvl === 0 ? 'G' : lvl !== null ? String(lvl) : String(name).trim().charAt(0).toUpperCase();
};
const ORD = ['Ground', '1st', '2nd', '3rd'];
const nextFloorName = (floors) => {
  const used = new Set(floors.map((f) => f.name.trim().toLowerCase()));
  const levels = floors.map((f) => floorLevel(f.name)).filter((n) => n !== null);
  let n = levels.length ? Math.max(...levels) + 1 : floors.length;
  const name = (k) => `${ORD[k] || `${k}th`} floor`;
  while (used.has(name(n).toLowerCase())) n += 1;
  return name(n);
};

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const CYCLES = [
  [7, '7 days (Weekly)'], [15, '15 days (Fortnightly)'], [30, '30 days (Monthly)'], [60, '60 days (2 Months)'],
  [90, '90 days (Quarterly)'], [180, '180 days (Half-Yearly)'], [365, '365 days (Yearly)'],
];

// a name with a pencil next to it; the pencil turns it into a small form (same as the web)
function Renamable({ value, label, onSave, theme, textStyle }) {
  const [draft, setDraft] = useState(null);
  if (draft === null) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}>
        <Text style={[textStyle, { flexShrink: 1 }]} numberOfLines={1}>{value}</Text>
        <TouchableOpacity accessibilityLabel={`Rename ${label}`} onPress={() => setDraft(value)} hitSlop={8}>
          <Icon name="create-outline" size={14} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
      <TextInput
        autoFocus
        value={draft}
        maxLength={60}
        onChangeText={setDraft}
        accessibilityLabel={`New name for ${label}`}
        style={[styles.renameInput, { color: theme.colors.text, borderColor: theme.colors.primary, backgroundColor: theme.colors.card }]}
      />
      <TouchableOpacity
        accessibilityLabel="Save name"
        disabled={!draft.trim()}
        onPress={async () => { if (draft.trim() && await onSave(draft.trim())) setDraft(null); }}
        style={[styles.renameBtn, { backgroundColor: theme.colors.primary, opacity: draft.trim() ? 1 : 0.5 }]}>
        <Icon name="checkmark" size={15} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity accessibilityLabel="Cancel" onPress={() => setDraft(null)} style={[styles.renameBtn, { borderWidth: 1, borderColor: theme.colors.border }]}>
        <Icon name="close" size={14} color={theme.colors.text} />
      </TouchableOpacity>
    </View>
  );
}

function Pills({ items, theme }) {
  const tone = { free: [theme.colors.successSoft, theme.colors.successDark], full: [theme.colors.infoSoft, theme.colors.infoDark] };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {items.map(([text, kind]) => {
        const [bg, fg] = tone[kind] || [theme.isDark ? 'rgba(148,163,184,0.16)' : '#E9EDF2', theme.colors.textSecondary];
        return (
          <View key={text} style={{ height: 22, paddingHorizontal: 8, borderRadius: 99, justifyContent: 'center', backgroundColor: bg }}>
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: fg }}>{text}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function SetupScreen({ navigation }) {
  const { biz } = useBiz();
  const { theme, isDark } = useTheme();

  const [plans, setPlans] = useState([]);
  const [groups, setGroups] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [floorModalOpen, setFloorModalOpen] = useState(false);

  // Forms
  const [planForm, setPlanForm] = useState({ name: '', cycleDays: '30', amount: '' });
  const [groupForm, setGroupForm] = useState({ name: '' });
  const [floorForm, setFloorForm] = useState({ groupId: '', name: '' });

  const isHostel = biz?.type === 'hostel';
  const w = words(biz?.type);
  const [folded, setFolded] = useState(() => new Set());
  const [editingRoom, setEditingRoom] = useState(null);
  const [addRoomAt, setAddRoomAt] = useState(null); // { group, floor }
  const [copyFrom, setCopyFrom] = useState(''); // a floor whose rooms the new floor copies
  const toggle = (id) => setFolded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const fetchSetupData = useCallback(async () => {
    if (!biz?._id) return;
    try {
      const [p, g] = await Promise.all([
        api(`/businesses/${biz._id}/plans`),
        api(`/businesses/${biz._id}/groups`),
      ]);
      setPlans(Array.isArray(p) ? p : []);
      setGroups(Array.isArray(g) ? g : []);

      if (biz?.type === 'hostel') {
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

  // Plan CRUD
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

  const handleDeletePlan = (planId, planName) => {
    Alert.alert('Delete Plan?', `Remove "${planName}"? Existing subscribers keep their plan.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/businesses/${biz._id}/plans/${planId}`, { method: 'DELETE' });
            await fetchSetupData();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  // Group / Building CRUD
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
      setError(err.message || 'Failed to create building/group');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = (groupId, groupName) => {
    Alert.alert(`Delete ${groupName}?`, 'The building/group will be removed from your setup.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/businesses/${biz._id}/groups/${groupId}`, { method: 'DELETE' });
            await fetchSetupData();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  // Floor CRUD (Hostel)
  const handleCreateFloor = async () => {
    if (!floorForm.name.trim()) {
      setError('Floor name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const updated = await api(`/businesses/${biz._id}/groups/${floorForm.groupId}/floors`, {
        method: 'POST',
        body: { name: floorForm.name.trim() },
      });
      // optionally the same rooms as another floor (same beds and rent, next numbers)
      const floor = updated?.floors?.find((f) => f.name.toLowerCase() === floorForm.name.trim().toLowerCase());
      if (floorCopy && floor) {
        for (const [i, r] of floorCopy.rooms.entries()) {
          await api(`/businesses/${biz._id}/rooms`, {
            method: 'POST',
            body: { groupId: floorForm.groupId, floorId: floor._id, roomNo: floorCopy.numbers[i], capacity: r.capacity, bedRent: r.bedRent ?? null },
          });
        }
      }
      setFloorModalOpen(false);
      setCopyFrom('');
      setFloorForm({ groupId: '', name: '' });
      await fetchSetupData();
    } catch (err) {
      setError(err.message || 'Failed to create floor');
    } finally {
      setLoading(false);
    }
  };

  const renameGroup = async (g, name) => {
    try {
      await api(`/businesses/${biz._id}/groups/${g._id}`, { method: 'PATCH', body: { name } });
      await fetchSetupData();
      return true;
    } catch (err) {
      Alert.alert('Error', err.message);
      return false;
    }
  };
  const renameFloor = async (g, f, name) => {
    try {
      await api(`/businesses/${biz._id}/groups/${g._id}/floors/${f._id}`, { method: 'PATCH', body: { name } });
      await fetchSetupData();
      return true;
    } catch (err) {
      Alert.alert('Error', err.message);
      return false;
    }
  };
  const handleDeleteFloor = (g, f) => {
    Alert.alert(`Delete ${f.name} of ${g.name}?`, 'The floor is removed from your setup.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete floor',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/businesses/${biz._id}/groups/${g._id}/floors/${f._id}`, { method: 'DELETE' });
            await fetchSetupData();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleDeleteRoom = (roomId, roomNo, capacity) => {
    Alert.alert(`Delete room ${roomNo}?`, `Its ${plural(capacity || 1, 'bed')} are removed from your setup. Past tenants keep their payment history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/businesses/${biz._id}/rooms/${roomId}`, { method: 'DELETE' });
            await fetchSetupData();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => natural(a.name, b.name)),
    [groups]
  );
  const roomsOf = (g) => rooms.filter((r) => String(r.groupId?._id || r.groupId) === g._id);
  const roomsOnFloor = (g, f) => roomsOf(g).filter((r) => r.floorId === f._id).sort((a, b) => natural(a.roomNo, b.roomNo));
  const loose = rooms.filter((r) => !r.groupId).sort((a, b) => natural(a.roomNo, b.roomNo));

  // the floor form: which floors can be copied, and the numbers the copy would get
  const floorGroup = groups.find((g) => g._id === floorForm.groupId);
  const floorsWithRooms = floorGroup ? (floorGroup.floors || []).filter((f) => roomsOnFloor(floorGroup, f).length) : [];
  const copySource = floorGroup && (floorGroup.floors || []).find((f) => f._id === copyFrom);
  const copyRooms = copySource ? roomsOnFloor(floorGroup, copySource) : [];
  const copyNums = copySource ? copyNumbers(copyRooms, roomsOf(floorGroup), floorGroup.floors.indexOf(copySource), floorGroup.floors.length) : null;
  const floorCopy = copyNums && { rooms: copyRooms, numbers: copyNums };
  const sameFloorName = floorGroup && floorForm.name.trim()
    && floorGroup.floors.find((f) => f.name.trim().toLowerCase() === floorForm.name.trim().toLowerCase());
  const openFloorForm = (g) => {
    const floors = g.floors || [];
    const withRooms = floors.filter((f) => roomsOnFloor(g, f).length);
    setError('');
    setFloorForm({ groupId: g._id, name: nextFloorName(floors) });
    setCopyFrom(withRooms[withRooms.length - 1]?._id || ''); // usually the same as the floor below
    setFloorModalOpen(true);
  };

  // one room tile, as in the web's Setup tree: edit, and delete while nobody lives there
  const roomTile = (r) => {
    const free = Math.max(0, r.capacity - (r.occupied || 0));
    const pct = Math.round((Math.min(r.occupied || 0, r.capacity) / r.capacity) * 100);
    return (
      <View key={r._id} style={[styles.roomTile, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderLeftColor: free ? '#10B981' : '#3B82F6' }]}>
        <View style={styles.roomTop}>
          <Text style={[styles.roomNo, { color: theme.colors.text }]}>{r.roomNo}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setEditingRoom(r)} accessibilityLabel={`Edit room ${r.roomNo}`} hitSlop={6}>
              <Icon name="create-outline" size={14} color={theme.colors.textMuted} />
            </TouchableOpacity>
            {!r.occupied && (
              <TouchableOpacity onPress={() => handleDeleteRoom(r._id, r.roomNo, r.capacity)} accessibilityLabel={`Delete room ${r.roomNo}`} hitSlop={6}>
                <Icon name="close" size={14} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.bedSquares}>
          {Array.from({ length: r.capacity }).map((_, i) => (
            <View key={i} style={[styles.bedSquare, i < (r.occupied || 0) ? { backgroundColor: '#3B82F6', borderColor: '#3B82F6' } : { borderColor: '#10B981' }]} />
          ))}
        </View>
        <View style={styles.roomFoot}>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: free ? '#10B981' : '#3B82F6' }}>{free ? `${free} free` : 'Full'}</Text>
          {r.bedRent != null && <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.colors.text }}>{rupees(r.bedRent)}</Text>}
        </View>
        <View style={[styles.roomTrack, { backgroundColor: theme.colors.border }]}>
          <View style={{ width: `${pct}%`, height: '100%', borderRadius: 99, backgroundColor: '#3B82F6' }} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Universal TopBar */}
      <TopBar navigation={navigation} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }>
        <Text style={[styles.headTitle, { color: theme.colors.text }]}>Setup</Text>
        <Text style={[styles.sectionSub, { color: theme.colors.textMuted, marginTop: -8, marginBottom: 14 }]}>{w.setupHint}</Text>

        {/* ============================================================ */}
        {/* HOSTEL STEP 1: Buildings, Floors & Rooms */}
        {/* ============================================================ */}
        {isHostel && (() => {
          const all = counts(rooms);
          return (
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.stepBadge, { backgroundColor: rooms.length ? '#10B981' : theme.colors.cardSubtle }]}>
                {rooms.length ? <Icon name="checkmark" size={13} color="#FFFFFF" /> : <Text style={{ fontWeight: '700', color: theme.colors.textMuted }}>1</Text>}
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Buildings, floors & rooms</Text>
            </View>
            <Text style={[styles.sectionSub, { color: theme.colors.textMuted }]}>
              {rooms.length
                ? `${groups.length} building${groups.length === 1 ? '' : 's'} · ${all.rooms} rooms · ${all.beds} beds · ${all.free} free`
                : 'Add your building, then its floors, then the rooms on each floor with their beds.'}
            </Text>
            <View style={styles.headBtns}>
              {rooms.length > 0 && (
                <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'RoomsTab' })} style={[styles.outlineBtn, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.outlineBtnText, { color: theme.colors.text }]}>See beds & tenants</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { setError(''); setGroupModalOpen(true); }} style={[styles.outlineBtn, { borderColor: theme.colors.border }]}>
                <Icon name="add" size={15} color={theme.colors.text} />
                <Text style={[styles.outlineBtnText, { color: theme.colors.text }]}>Add building</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 14, marginTop: 14 }}>
              {sortedGroups.map((g, gi) => {
                const accent = ACCENTS[gi % ACCENTS.length];
                const gRooms = rooms.filter((r) => String(r.groupId?._id || r.groupId) === g._id);
                const floors = g.floors || [];
                const c = counts(gRooms);
                const open = !folded.has(g._id);
                return (
                  <View key={g._id} style={[styles.building, {
                    borderColor: tint(accent, 0.3, theme.colors.card),
                    borderTopColor: accent,
                    backgroundColor: tint(accent, theme.isDark ? 0.06 : 0.025, theme.colors.cardSubtle),
                  }]}>
                    <View style={styles.buildingHead}>
                      <TouchableOpacity onPress={() => toggle(g._id)} style={styles.foldBtn} accessibilityLabel={`${open ? 'Fold' : 'Open'} ${g.name}`}>
                        <Icon name={open ? 'chevron-down' : 'chevron-forward'} size={15} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                      <View style={[styles.buildingIcon, { backgroundColor: accent }]}>
                        <Icon name="business" size={18} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                        <Renamable value={g.name} label={g.name} theme={theme} onSave={(n) => renameGroup(g, n)}
                          textStyle={[styles.buildingTitle, { color: theme.colors.text }]} />
                        <Pills theme={theme} items={[
                          [`${floors.length} floor${floors.length === 1 ? '' : 's'}`],
                          [`${c.rooms} rooms`], [`${c.beds} beds`],
                          [c.free ? `${c.free} free` : 'Full', c.free ? 'free' : 'full'],
                        ]} />
                      </View>
                      {!gRooms.length && !floors.length && (
                        <TouchableOpacity onPress={() => handleDeleteGroup(g._id, g.name)} style={[styles.iconBtn, { borderColor: theme.colors.border }]}>
                          <Icon name="trash-outline" size={14} color={theme.colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                    {c.beds > 0 && (
                      <View style={styles.fillRow}>
                        <Text style={[styles.fillText, { color: theme.colors.text }]}>{c.pct}%<Text style={{ fontWeight: '400', color: theme.colors.textMuted }}> full</Text></Text>
                        <View style={[styles.fillTrack, { backgroundColor: theme.colors.border }]}>
                          <View style={{ width: `${c.pct}%`, height: '100%', borderRadius: 99, backgroundColor: accent }} />
                        </View>
                      </View>
                    )}

                    {open && (
                      <View style={[styles.floors, { borderLeftColor: tint(accent, 0.45, theme.colors.card) }]}>
                        {floors.map((f) => {
                          const fRooms = roomsOnFloor(g, f);
                          const fc = counts(fRooms);
                          return (
                            <View key={f._id} style={{ gap: 10 }}>
                              <View style={styles.floorHead}>
                                <View style={[styles.levelBadge, { backgroundColor: tint(accent, 0.14, theme.colors.card) }]}>
                                  <Text style={{ color: accent, fontWeight: '800', fontSize: 12.5 }}>{floorBadge(f.name)}</Text>
                                </View>
                                <Renamable value={f.name} label={f.name} theme={theme} onSave={(n) => renameFloor(g, f, n)}
                                  textStyle={[styles.floorTitle, { color: theme.colors.text }]} />
                              </View>
                              <View style={styles.floorMeta}>
                                {fRooms.length ? (
                                  <Pills theme={theme} items={[[`${fc.rooms} rooms`], [`${fc.beds} beds`], [fc.free ? `${fc.free} free` : 'Full', fc.free ? 'free' : 'full']]} />
                                ) : <Pills theme={theme} items={[['no rooms yet']]} />}
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                  <TouchableOpacity
                                    onPress={() => setAddRoomAt({ group: g, floor: f })}
                                    style={[styles.outlineBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                                    <Icon name="add" size={14} color={theme.colors.text} />
                                    <Text style={[styles.outlineBtnText, { color: theme.colors.text }]}>Add room</Text>
                                  </TouchableOpacity>
                                  {!fRooms.length && (
                                    <TouchableOpacity
                                      accessibilityLabel={`Delete ${f.name}`}
                                      onPress={() => handleDeleteFloor(g, f)}
                                      style={[styles.iconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                                      <Icon name="trash-outline" size={14} color={theme.colors.danger} />
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                              {fRooms.length > 0 && <View style={styles.roomGrid}>{fRooms.map(roomTile)}</View>}
                            </View>
                          );
                        })}
                        {(() => {
                          const noFloor = gRooms.filter((r) => !r.floorId || !floors.some((f) => f._id === r.floorId));
                          if (!noFloor.length) return null;
                          return (
                            <View style={{ gap: 10 }}>
                              <View style={styles.floorHead}>
                                <View style={[styles.levelBadge, { backgroundColor: tint(accent, 0.14, theme.colors.card) }]}>
                                  <Text style={{ color: accent, fontWeight: '800', fontSize: 12.5 }}>?</Text>
                                </View>
                                <Text style={[styles.floorTitle, { color: theme.colors.text }]}>Not on a floor yet</Text>
                              </View>
                              <View style={styles.roomGrid}>{noFloor.sort((a, b) => natural(a.roomNo, b.roomNo)).map(roomTile)}</View>
                            </View>
                          );
                        })()}
                        <TouchableOpacity
                          onPress={() => openFloorForm(g)}
                          style={[styles.addFloorBtn, { borderColor: tint(accent, 0.5, theme.colors.card), backgroundColor: tint(accent, 0.05, theme.colors.card) }]}>
                          <Icon name="add" size={14} color={accent} />
                          <Text style={{ color: accent, fontWeight: '700', fontSize: 13.5 }}>Add floor</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}

              {loose.length > 0 && (
                <View style={[styles.building, { borderColor: theme.colors.border, backgroundColor: theme.colors.cardSubtle }]}>
                  <Text style={[styles.buildingTitle, { color: theme.colors.text }]}>Rooms not in a building</Text>
                  <Pills theme={theme} items={[[`${counts(loose).rooms} rooms`], [`${counts(loose).beds} beds`], [`${counts(loose).free} free`, 'free']]} />
                  <View style={[styles.roomGrid, { marginTop: 10 }]}>{loose.map(roomTile)}</View>
                </View>
              )}

              {sortedGroups.length === 0 && loose.length === 0 && (
                <View style={styles.emptyCardInner}>
                  <Icon name="business-outline" size={36} color={theme.colors.textMuted} />
                  <Text style={[styles.emptyCardTitle, { color: theme.colors.text }]}>No buildings yet</Text>
                  <Text style={[styles.emptyCardSub, { color: theme.colors.textSecondary }]}>
                    Even with just one building, add it first. Then add its floors and rooms.
                  </Text>
                </View>
              )}
            </View>
          </View>
          );
        })()}

        {/* ============================================================ */}
        {/* MEMBERSHIP PLANS (Hostel Step 2 or Gym/Tuition Step 1) */}
        {/* ============================================================ */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeadRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.stepBadge, { backgroundColor: plans.length ? '#10B981' : theme.colors.cardSubtle }]}>
                  {plans.length ? <Icon name="checkmark" size={13} color="#FFFFFF" /> : <Text style={{ fontWeight: '700', color: theme.colors.textMuted }}>{isHostel ? 2 : 1}</Text>}
                </View>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{w.plans}</Text>
              </View>
              <Text style={[styles.sectionSub, { color: theme.colors.textMuted }]}>{w.plansHint}</Text>
            </View>

          </View>
          <View style={styles.headBtns}>
            <TouchableOpacity onPress={() => { setError(''); setPlanModalOpen(true); }} style={[styles.outlineBtn, { borderColor: theme.colors.border }]}>
              <Icon name="add" size={15} color={theme.colors.text} />
              <Text style={[styles.outlineBtnText, { color: theme.colors.text }]}>Add {w.plan.toLowerCase()}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 8, marginTop: 12 }}>
            {[...plans].sort((x, y) => x.amount - y.amount || natural(x.name, y.name)).map((p) => (
              <View
                key={p._id}
                style={[
                  styles.planItem,
                  { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border },
                ]}>
                <View style={[styles.planIconWrap, { backgroundColor: theme.colors.primarySoft }]}>
                  <Icon name="card-outline" size={16} color="#10B981" />
                </View>

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.planName, { color: theme.colors.text }]}>{p.name}</Text>
                  <Text style={[styles.planCycle, { color: theme.colors.textSecondary }]}>
                    {p.cycleDays} days recurring cycle
                  </Text>
                </View>

                <View style={[styles.pricePill, { backgroundColor: theme.colors.infoSoft }]}>
                  <Text style={{ color: theme.colors.infoDark, fontWeight: '700', fontSize: 12.5 }}>{rupees(p.amount)}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleDeletePlan(p._id, p.name)}
                  style={[styles.trashBtn, { borderColor: theme.colors.border, marginLeft: 8 }]}>
                  <Icon name="trash-outline" size={13} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
            ))}

            {plans.length === 0 && (
              <View style={styles.emptyCardInner}>
                <Text style={[styles.emptyCardSub, { color: theme.colors.textSecondary }]}>
                  Add what you charge, for example {w.planExample}. You pick a plan when you add each {w.member}.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Batches / time slots (optional), everyone except hostels */}
        {!isHostel && (
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.stepBadge, { backgroundColor: groups.length ? '#10B981' : theme.colors.cardSubtle }]}>
                {groups.length ? <Icon name="checkmark" size={13} color="#FFFFFF" /> : <Text style={{ fontWeight: '700', color: theme.colors.textMuted }}>2</Text>}
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{w.groups}</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12.5 }}>(optional)</Text>
            </View>
            <Text style={[styles.sectionSub, { color: theme.colors.textMuted }]}>{w.groupsHint}</Text>
            <View style={styles.headBtns}>
              <TouchableOpacity onPress={() => { setError(''); setGroupModalOpen(true); }} style={[styles.outlineBtn, { borderColor: theme.colors.border }]}>
                <Icon name="add" size={15} color={theme.colors.text} />
                <Text style={[styles.outlineBtnText, { color: theme.colors.text }]}>Add {w.group.toLowerCase()}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 8, marginTop: 12 }}>
              {sortedGroups.map((g) => (
                <View key={g._id} style={[styles.planItem, { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border }]}>
                  <View style={[styles.planIconWrap, { backgroundColor: theme.colors.warningSoft }]}>
                    <Icon name="pricetag-outline" size={16} color={theme.colors.warningDark} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Renamable value={g.name} label={g.name} theme={theme} onSave={(n) => renameGroup(g, n)}
                      textStyle={[styles.planName, { color: theme.colors.text }]} />
                  </View>
                  <View style={[styles.pricePill, { backgroundColor: theme.colors.cardSubtle, borderWidth: 1, borderColor: theme.colors.border }]}>
                    <Text style={{ color: theme.colors.textSecondary, fontWeight: '600', fontSize: 12 }}>Active</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteGroup(g._id, g.name)}
                    style={[styles.trashBtn, { borderColor: theme.colors.border, marginLeft: 8 }]}>
                    <Icon name="trash-outline" size={13} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              {groups.length === 0 && (
                <View style={styles.emptyCardInner}>
                  <Text style={[styles.emptyCardTitle, { color: theme.colors.text }]}>No {w.groups.toLowerCase()} yet</Text>
                  <Text style={[styles.emptyCardSub, { color: theme.colors.textSecondary }]}>Optional. {w.groupsHint}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Plan Modal */}
      <Modal
        visible={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title={`New ${w.plan.toLowerCase()}`}
        subtitle="What you charge and how often">
        <View style={{ gap: 10 }}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Input
            label="Plan Name *"
            value={planForm.name}
            onChangeText={(v) => setPlanForm({ ...planForm, name: v })}
            placeholder={w.planPlaceholder}
          />
          <Input
            label="Amount (₹) *"
            value={planForm.amount}
            onChangeText={(v) => setPlanForm({ ...planForm, amount: v })}
            placeholder="1500"
            keyboardType="numeric"
          />
          <Text style={[styles.outlineBtnText, { color: theme.colors.text, marginBottom: 2 }]}>Billing Cycle Length</Text>
          <View style={styles.cycleChips}>
            {CYCLES.map(([d, label]) => {
              const on = String(planForm.cycleDays) === String(d);
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => setPlanForm({ ...planForm, cycleDays: String(d) })}
                  style={[styles.cycleChip, { backgroundColor: on ? theme.colors.primarySoft : theme.colors.card, borderColor: on ? theme.colors.primary : theme.colors.border }]}>
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: on ? theme.colors.primaryDark : theme.colors.textSecondary }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Button
            title={loading ? 'Saving Plan…' : 'Save Plan'}
            variant="primary"
            loading={loading}
            onPress={handleCreatePlan}
            style={{ marginTop: 6 }}
          />
        </View>
      </Modal>

      {/* Building / Group Modal */}
      <Modal
        visible={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        title={`New ${w.group.toLowerCase()}`}
        subtitle={w.groupsHint}>
        <View style={{ gap: 10 }}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Input
            label={`${w.group} name *`}
            value={groupForm.name}
            onChangeText={(v) => setGroupForm({ ...groupForm, name: v })}
            placeholder={w.groupPlaceholder}
          />
          <Button
            title={`Save ${w.group.toLowerCase()}`}
            variant="primary"
            loading={loading}
            onPress={handleCreateGroup}
            style={{ marginTop: 6 }}
          />
        </View>
      </Modal>

      {/* Floor Modal (Hostel) */}
      <Modal
        visible={floorModalOpen}
        onClose={() => setFloorModalOpen(false)}
        title="Add Floor"
        subtitle="Floor name for this building">
        <View style={{ gap: 10 }}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Input
            label="Floor Name *"
            value={floorForm.name}
            onChangeText={(v) => setFloorForm({ ...floorForm, name: v })}
            placeholder="e.g. Ground floor, 1st floor, Terrace"
          />
          {sameFloorName ? (
            <Text style={styles.errorText}>{floorGroup.name} already has {sameFloorName.name}.</Text>
          ) : null}
          {floorsWithRooms.length > 0 && (
            <>
              <Text style={[styles.outlineBtnText, { color: theme.colors.text }]}>Rooms on it</Text>
              <View style={styles.cycleChips}>
                {[{ _id: '', label: 'Start empty' }, ...floorsWithRooms.map((f) => ({ _id: f._id, label: `Same as ${f.name} (${plural(roomsOnFloor(floorGroup, f).length, 'room')})` }))].map((o) => {
                  const on = copyFrom === o._id;
                  return (
                    <TouchableOpacity
                      key={o._id || 'empty'}
                      onPress={() => setCopyFrom(o._id)}
                      style={[styles.cycleChip, { backgroundColor: on ? theme.colors.primarySoft : theme.colors.card, borderColor: on ? theme.colors.primary : theme.colors.border }]}>
                      <Text style={{ fontSize: 12.5, fontWeight: '600', color: on ? theme.colors.primaryDark : theme.colors.textSecondary }}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
          {copySource ? (
            <Text style={[styles.copyPreview, { color: floorCopy ? theme.colors.textSecondary : theme.colors.danger }]}>
              {floorCopy
                ? `Adds rooms ${floorCopy.numbers.join(', ')} with the same beds${copyRooms.some((r) => r.bedRent != null) ? ' and rent' : ''} as ${copySource.name}.`
                : `The rooms of ${copySource.name} can't be numbered automatically. Start empty and add them by hand.`}
            </Text>
          ) : null}
          <Button
            title={floorCopy ? `Add floor with ${plural(floorCopy.rooms.length, 'room')}` : 'Add floor'}
            variant="primary"
            loading={loading}
            disabled={!floorForm.name.trim() || Boolean(sameFloorName) || Boolean(copySource && !floorCopy)}
            onPress={handleCreateFloor}
            style={{ marginTop: 6 }}
          />
        </View>
      </Modal>

      <AddRoomModal
        visible={Boolean(addRoomAt)}
        biz={biz}
        group={addRoomAt?.group}
        floor={addRoomAt?.floor}
        existing={rooms}
        onClose={() => setAddRoomAt(null)}
        onSaved={fetchSetupData}
      />
      <EditRoomModal
        visible={Boolean(editingRoom)}
        biz={biz}
        room={editingRoom}
        groups={sortedGroups}
        onClose={() => setEditingRoom(null)}
        onSaved={fetchSetupData}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  renameInput: {
    flex: 1,
    height: 34,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  renameBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cycleChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  copyPreview: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  headTitle: { fontSize: 24, fontWeight: '600', marginBottom: 14 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  outlineBtnText: { fontSize: 13.5, fontWeight: '600' },
  building: { borderWidth: 1, borderTopWidth: 3, borderRadius: 14, padding: 12, gap: 10 },
  foldBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  buildingIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fillRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 4 },
  fillText: { fontSize: 15, fontWeight: '800' },
  fillTrack: { flex: 1, height: 8, borderRadius: 99, overflow: 'hidden' },
  floors: { borderLeftWidth: 2, borderStyle: 'dashed', marginLeft: 12, paddingLeft: 12, gap: 16, paddingBottom: 4 },
  levelBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  floorMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roomTile: { flexBasis: '46%', flexGrow: 1, borderWidth: 1, borderLeftWidth: 3, borderRadius: 12, padding: 12, gap: 8 },
  roomTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomNo: { fontSize: 16, fontWeight: '800' },
  bedSquares: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  bedSquare: { width: 13, height: 13, borderRadius: 4, borderWidth: 1.5 },
  roomFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  roomTrack: { height: 4, borderRadius: 99, overflow: 'hidden' },
  addFloorBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 36, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed' },
  pricePill: { paddingHorizontal: 10, height: 26, borderRadius: 99, justifyContent: 'center' },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 40,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backPillText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  pageHeader: {
    marginBottom: 14,
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
  sectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 1,
  },
  btnAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  btnActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  buildingBlock: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  buildingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buildingTitle: {
    fontSize: 16.5,
    fontWeight: '700',
  },
  smallBtn: {
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  smallBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  trashBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorBlock: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  floorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floorTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  roomsPillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  roomChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  planItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  planIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  planCycle: {
    fontSize: 11,
    marginTop: 1,
  },
  planPrice: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCardInner: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyCardSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
  },
});
