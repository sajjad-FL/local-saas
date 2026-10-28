import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees } from '../../api/api';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import AddMemberModal from '../modals/AddMemberModal';
import { AddRoomModal, EditRoomModal } from '../modals/RoomModals';
import { tint } from '../../constants/theme';

function bedState(tenant) {
  if (!tenant) return 'free';
  if (tenant.balance > 0) return 'overdue';
  if (tenant.noticeGivenOn) return 'leaving';
  return 'taken';
}

const natural = (a, b) =>
  String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

const BLOCK_TINTS = ['#EC4899', '#14B8A6', '#8B5CF6', '#F59E0B', '#3B82F6', '#10B981'];
const STATE = {
  free: { color: '#10B981', text: 'Available' },
  taken: { color: '#3B82F6', text: 'Occupied' },
  leaving: { color: '#F59E0B', text: 'Leaving' },
  overdue: { color: '#EF4444', text: 'Overdue' },
};
const firstName = (n) => String(n || '').trim().split(/\s+/)[0];

// consecutive floor sections -> one block per building
function byBuilding(sections) {
  const blocks = [];
  for (const sec of sections) {
    const key = sec.group?._id || 'loose';
    const last = blocks[blocks.length - 1];
    if (last?.key === key) last.sections.push(sec);
    else blocks.push({ key, name: sec.building || 'Other rooms', sections: [sec] });
  }
  return blocks;
}

// "4 rooms", "12 beds", "9 free" pills, like the web's .prop-chip
function Pills({ items, theme }) {
  const tone = {
    free: [theme.colors.successSoft, theme.colors.successDark],
    full: [theme.colors.infoSoft, theme.colors.infoDark],
    due: [theme.colors.dangerSoft, theme.colors.danger],
  };
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

// Cards view: a room with a big tile per bed
function RoomCard({ room, theme, onBed, onAddBed, onRemoveBed, onEdit }) {
  const free = room.beds.filter((b) => b.state === 'free').length;
  return (
    <View style={[styles.roomCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.roomHead}>
        <View style={[styles.doorBox, { backgroundColor: theme.colors.cardSubtle }]}>
          <Icon name="enter-outline" size={18} color={theme.colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.roomTitle, { color: theme.colors.text }]}>Room {room.roomNo}</Text>
            <TouchableOpacity onPress={onEdit} accessibilityLabel={`Edit room ${room.roomNo}`} hitSlop={8}>
              <Icon name="create-outline" size={14} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.roomSub, { color: theme.colors.textMuted }]}>
            {room.capacity} bed{room.capacity === 1 ? '' : 's'} · {free ? `${free} available` : 'full'}
          </Text>
        </View>
        <TouchableOpacity onPress={onAddBed} style={[styles.addBedBtn, { borderColor: theme.colors.border }]}>
          <Icon name="add" size={13} color={theme.colors.textMuted} />
          <Text style={[styles.addBedText, { color: theme.colors.textMuted }]}>Bed</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.bedGrid}>
        {room.beds.map((b) => {
          const st = STATE[b.state];
          // only an empty bed can go; the last one stays (delete the room instead)
          const removable = b.state === 'free' && room.capacity > 1 && b.num > room.beds.filter((x) => x.tenant).length;
          return (
            <View key={b.num} style={styles.bedWrap}>
            <TouchableOpacity activeOpacity={0.75} onPress={() => onBed(b)}
              style={[styles.bedTile, {
                borderColor: st.color,
                backgroundColor: b.state === 'free' ? theme.colors.card : tint(st.color, theme.isDark ? 0.14 : 0.07, theme.colors.card),
              }]}>
              {b.state === 'overdue' && (
                <View style={styles.bedFlag}><Text style={styles.bedFlagText}>!</Text></View>
              )}
              <View style={{ alignSelf: 'center' }}><Icon name="bed-outline" size={22} color={st.color} /></View>
              <Text style={[styles.bedName, { color: theme.colors.text }]} numberOfLines={1}>
                {b.tenant ? firstName(b.tenant.name) : `Bed ${b.num}`}
              </Text>
              <Text style={[styles.bedState, { color: st.color }]}>{b.tenant ? `Bed ${b.num} · ${st.text}` : 'Available'}</Text>
              <Text style={[styles.bedAmount, { color: b.state === 'overdue' ? theme.colors.danger : b.tenant ? theme.colors.textSecondary : theme.colors.textMuted, fontWeight: b.state === 'overdue' ? '700' : '500' }]}>
                {b.state === 'overdue' ? `${rupees(b.tenant.balance)} due`
                  : b.tenant ? (b.tenant.planAmount ? rupees(b.tenant.planAmount) : '—')
                  : room.bedRent != null ? rupees(room.bedRent) : 'Add tenant'}
              </Text>
            </TouchableOpacity>
            {removable && (
              <TouchableOpacity
                onPress={onRemoveBed}
                accessibilityLabel={`Remove bed ${b.num} from room ${room.roomNo}`}
                style={[styles.bedRemove, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Icon name="close" size={12} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Compact view: the same tile as Setup, one square per bed
function RoomMini({ room, theme, onBed, onEdit }) {
  const free = room.beds.filter((b) => b.state === 'free').length;
  const due = room.beds.some((b) => b.state === 'overdue');
  const edge = due ? '#EF4444' : free ? '#10B981' : '#3B82F6';
  const pct = Math.round(((room.beds.length - free) / Math.max(room.beds.length, 1)) * 100);
  return (
    <View style={[styles.miniTile, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderLeftColor: edge }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[styles.miniNo, { color: theme.colors.text }]}>{room.roomNo}</Text>
        <TouchableOpacity onPress={onEdit} accessibilityLabel={`Edit room ${room.roomNo}`} hitSlop={8}>
          <Icon name="create-outline" size={13} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={styles.miniBeds}>
        {room.beds.map((b) => {
          const st = STATE[b.state];
          return (
            <TouchableOpacity key={b.num} onPress={() => onBed(b)}
              style={[styles.miniBed, { borderColor: st.color, backgroundColor: b.state === 'free' ? 'transparent' : st.color }]}>
              <Text style={styles.miniBedText}>{b.tenant ? firstName(b.tenant.name).slice(0, 1).toUpperCase() : ''}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.miniFoot}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: due ? theme.colors.danger : free ? theme.colors.primary : theme.colors.infoDark }}>
          {free ? `${free} free` : 'Full'}
        </Text>
        {room.bedRent != null && <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>{rupees(room.bedRent)}</Text>}
      </View>
      <View style={[styles.miniTrack, { backgroundColor: theme.colors.border }]}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 99, backgroundColor: due ? '#EF4444' : '#3B82F6' }} />
      </View>
    </View>
  );
}

export default function RoomsScreen({ navigation }) {
  const { biz } = useBiz();
  const { theme, isDark } = useTheme();

  const [rooms, setRooms] = useState([]);
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [show, setShow] = useState('all'); // 'all' | 'free' | 'taken' | 'overdue'
  const [buildingId, setBuildingId] = useState('all');
  const [floorId, setFloorId] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'compact'
  const [foldedFloors, setFoldedFloors] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Add tenant modal with preselected room
  const [addTenantOpen, setAddTenantOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [editingRoom, setEditingRoom] = useState(null);
  const [addRoomAt, setAddRoomAt] = useState(null); // { group, floor }

  const fetchRoomsData = useCallback(async () => {
    if (!biz?._id) return;
    try {
      const [r, m, g] = await Promise.all([
        api(`/businesses/${biz._id}/rooms`),
        api(`/businesses/${biz._id}/members`),
        api(`/businesses/${biz._id}/groups`),
      ]);
      setRooms(Array.isArray(r) ? r : []);
      setMembers(Array.isArray(m) ? m : []);
      setGroups(Array.isArray(g) ? g : []);
    } catch (err) {
      console.warn('Rooms fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [biz?._id]);

  useEffect(() => {
    fetchRoomsData();
  }, [fetchRoomsData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRoomsData();
    setRefreshing(false);
  };

  // Tenants mapped by room
  const tenantsIn = useMemo(() => {
    const map = new Map();
    for (const m of members) {
      const rid = m.roomId?._id || m.roomId;
      if (m.status !== 'active' || !rid) continue;
      const key = String(rid);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.joinDate) - new Date(b.joinDate));
    }
    return map;
  }, [members]);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => natural(a.name, b.name)),
    [groups]
  );
  const activeBuilding =
    sortedGroups.length === 1 ? sortedGroups[0] : sortedGroups.find((g) => g._id === buildingId);
  const floorTabs = activeBuilding?.floors || [];

  // Bed counts
  const allRoomsWithBeds = useMemo(() => {
    return rooms.map((r) => {
      const rTenants = tenantsIn.get(String(r._id)) || [];
      const beds = Array.from({ length: Math.max(r.capacity, rTenants.length) }, (_, i) => ({
        num: i + 1,
        tenant: rTenants[i] || null,
        state: bedState(rTenants[i]),
      }));
      return { ...r, beds };
    });
  }, [rooms, tenantsIn]);

  const inPlace = useMemo(() => {
    return allRoomsWithBeds.filter((r) => {
      const bId = String(r.groupId?._id || r.groupId || '');
      if (activeBuilding && sortedGroups.length > 1 && bId !== activeBuilding._id) return false;
      if (floorId !== 'all' && r.floorId !== floorId) return false;
      return true;
    });
  }, [allRoomsWithBeds, activeBuilding, sortedGroups, floorId]);

  const placeBeds = useMemo(() => inPlace.flatMap((r) => r.beds), [inPlace]);
  const totals = useMemo(() => {
    const free = placeBeds.filter((b) => b.state === 'free').length;
    const overdue = placeBeds.filter((b) => b.state === 'overdue').length;
    const taken = placeBeds.length - free;
    return { all: placeBeds.length, free, taken, overdue };
  }, [placeBeds]);

  const query = search.trim().toLowerCase().replace(/^room\s*/, '');
  const matches = (r) => {
    const matchState =
      show === 'all'
        ? true
        : show === 'taken'
        ? r.beds.some((b) => b.state !== 'free')
        : r.beds.some((b) => b.state === show);

    const matchText =
      !query ||
      String(r.roomNo).toLowerCase().includes(query) ||
      r.beds.some((b) => b.tenant?.name?.toLowerCase().includes(query));

    return matchState && matchText;
  };

  // Group into floor sections
  const sections = useMemo(() => {
    const list = [];
    for (const g of sortedGroups) {
      if (activeBuilding && sortedGroups.length > 1 && g._id !== activeBuilding._id) continue;
      const inBuilding = inPlace.filter((r) => String(r.groupId?._id || r.groupId || '') === g._id);

      for (const f of g.floors || []) {
        if (floorId !== 'all' && f._id !== floorId) continue;
        list.push({
          key: f._id,
          group: g,
          floor: f,
          title: f.name,
          building: g.name,
          rooms: inBuilding.filter((r) => r.floorId === f._id),
        });
      }

      const noFloor = inBuilding.filter(
        (r) => !r.floorId || !(g.floors || []).some((f) => f._id === r.floorId)
      );
      if (floorId === 'all' && (noFloor.length || !(g.floors || []).length)) {
        list.push({
          key: g._id,
          group: g,
          title: 'No floor',
          building: g.name,
          rooms: noFloor,
        });
      }
    }

    const loose = inPlace.filter((r) => !r.groupId);
    if ((!activeBuilding || sortedGroups.length === 1) && floorId === 'all' && loose.length) {
      list.push({ key: 'loose', title: 'Not in a building', building: 'Other rooms', rooms: loose });
    }

    for (const s of list) {
      s.total = s.rooms;
      s.rooms = s.rooms.filter(matches).sort((a, b) => natural(a.roomNo, b.roomNo));
    }

    const filtering = show !== 'all' || !!query;
    return filtering ? list.filter((s) => s.rooms.length > 0) : list;
  }, [sortedGroups, activeBuilding, floorId, inPlace, show, query]);

  const toggleFold = (key) => {
    setFoldedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openBed = (r, b) => {
    if (b.tenant) navigation.navigate('MemberDetail', { id: b.tenant._id });
    else { setSelectedRoomId(r._id); setAddTenantOpen(true); }
  };

  // Adjust beds
  const handleRemoveBed = (r) => {
    if (r.capacity <= 1) {
      Alert.alert('Only one bed', `Room ${r.roomNo} has only one bed. Delete the room in Setup instead.`);
      return;
    }
    Alert.alert(
      `Remove a bed from room ${r.roomNo}?`,
      `Room ${r.roomNo} goes from ${r.capacity} beds to ${r.capacity - 1} bed${r.capacity - 1 === 1 ? '' : 's'}. Tenants stay where they are.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove bed', style: 'destructive', onPress: () => handleSetCapacity(r, r.capacity - 1) },
      ]
    );
  };

  const handleSetCapacity = async (r, newCap) => {
    if (newCap > 30) {
      Alert.alert('Too many beds', 'A room can have at most 30 beds.');
      return;
    }
    if (newCap < 1) return;
    try {
      await api(`/businesses/${biz._id}/rooms/${r._id}`, {
        method: 'PATCH',
        body: { capacity: newCap },
      });
      fetchRoomsData();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Universal TopBar Header */}
      <TopBar navigation={navigation} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }>
        {/* Header: title, hint, Add tenant (same as the web on phones) */}
        <Text style={[styles.headTitle, { color: theme.colors.text }]}>Rooms</Text>
        <Text style={[styles.headSub, { color: theme.colors.textMuted }]}>Tap a free bed to add a tenant there</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.addTenantBtn}
          onPress={() => { setSelectedRoomId(''); setAddTenantOpen(true); }}>
          <Icon name="add" size={17} color="#FFFFFF" />
          <Text style={styles.addTenantText}>Add tenant</Text>
        </TouchableOpacity>

        {/* Building */}
        {sortedGroups.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            {[{ _id: 'all', name: 'All buildings' }, ...sortedGroups].map((g) => {
              const active = (activeBuilding?._id || 'all') === g._id;
              return (
                <TouchableOpacity
                  key={g._id}
                  onPress={() => { setBuildingId(g._id); setFloorId('all'); }}
                  style={[styles.chip, { backgroundColor: active ? theme.colors.primary : theme.colors.card, borderColor: active ? theme.colors.primary : theme.colors.border }]}>
                  <Text style={[styles.chipText, { color: active ? '#FFFFFF' : theme.colors.textSecondary }]}>{g.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Search + Cards / Compact */}
        <View style={styles.toolRow}>
          <View style={[styles.searchBox, { flex: 1, backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder }]}>
            <Icon name="search-outline" size={16} color={theme.colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Room or tenant"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.searchInput, { color: theme.colors.text }]}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Icon name="close-circle" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={[styles.segment, { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border }]}>
            {['cards', 'compact'].map((v) => (
              <TouchableOpacity key={v} onPress={() => setViewMode(v)}
                style={[styles.segmentBtn, viewMode === v && { backgroundColor: theme.colors.card, ...styles.segmentActive }]}>
                <Text style={[styles.segmentText, { color: viewMode === v ? theme.colors.text : theme.colors.textMuted }]}>
                  {v === 'cards' ? 'Cards' : 'Compact'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Floors of the chosen building */}
        {floorTabs.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            {[{ _id: 'all', name: 'All floors' }, ...floorTabs].map((f) => {
              const active = floorId === f._id;
              const fFree = f._id === 'all' ? null : allRoomsWithBeds.filter((r) => r.floorId === f._id).flatMap((r) => r.beds).filter((b) => b.state === 'free').length;
              return (
                <TouchableOpacity key={f._id} onPress={() => setFloorId(f._id)}
                  style={[styles.chip, { backgroundColor: active ? theme.colors.primary : theme.colors.card, borderColor: active ? theme.colors.primary : theme.colors.border }]}>
                  <Text style={[styles.chipText, { color: active ? '#FFFFFF' : theme.colors.textSecondary }]}>
                    {f.name}{fFree !== null ? `  ${fFree} free` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Counts double as filters */}
        <View style={styles.countGrid}>
          {[
            { id: 'all', label: 'All beds', count: totals.all, color: '#64748B' },
            { id: 'free', label: 'Available', count: totals.free, color: '#10B981' },
            { id: 'taken', label: 'Occupied', count: totals.taken, color: '#3B82F6' },
            { id: 'overdue', label: 'Overdue', count: totals.overdue, color: '#EF4444' },
          ].map((c) => {
            const active = show === c.id;
            return (
              <TouchableOpacity key={c.id} activeOpacity={0.8} onPress={() => setShow(active ? 'all' : c.id)}
                style={[styles.countBox, {
                  backgroundColor: tint(c.color, theme.isDark ? 0.12 : 0.06, theme.colors.card),
                  borderColor: active ? c.color : tint(c.color, 0.3, theme.colors.card),
                  borderWidth: active ? 1.5 : 1,
                }]}>
                <View style={[styles.countDot, { backgroundColor: c.color }]} />
                <Text style={[styles.countLabel, { color: theme.colors.textSecondary }]}>{c.label}</Text>
                <Text style={[styles.countValue, { color: theme.colors.text }]}>{c.count}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {sections.length > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryText, { color: theme.colors.textMuted }]}>
              {sections.reduce((n, sec) => n + sec.rooms.length, 0)} rooms on {sections.length} floor{sections.length === 1 ? '' : 's'}
            </Text>
            {sections.length > 1 && show === 'all' && !query && (
              <TouchableOpacity onPress={() => {
                const allFolded = sections.every((sec) => foldedFloors.has(sec.key));
                setFoldedFloors(allFolded ? new Set() : new Set(sections.map((sec) => sec.key)));
              }}>
                <Text style={[styles.summaryLink, { color: theme.colors.primary }]}>
                  {sections.every((sec) => foldedFloors.has(sec.key)) ? 'Open all floors' : 'Fold all floors'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* One block per building, its floors inside */}
        {byBuilding(sections).map((blk, bi) => {
          const bBeds = blk.sections.flatMap((sec) => sec.total.flatMap((r) => r.beds));
          const bFree = bBeds.filter((b) => b.state === 'free').length;
          const bDue = bBeds.filter((b) => b.state === 'overdue').length;
          const accent = BLOCK_TINTS[bi % BLOCK_TINTS.length];
          return (
            <View key={blk.key} style={[styles.block, {
              backgroundColor: tint(accent, theme.isDark ? 0.07 : 0.035, theme.colors.card),
              borderColor: tint(accent, 0.22, theme.colors.card),
            }]}>
              {sortedGroups.length > 1 && !activeBuilding && (
                <View style={[styles.blockHead, { borderBottomColor: theme.colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="business-outline" size={16} color={accent} />
                    <Text style={[styles.blockTitle, { color: theme.colors.text }]}>{blk.name}</Text>
                  </View>
                  <Pills theme={theme} items={[
                    [`${blk.sections.reduce((n, sec) => n + sec.total.length, 0)} rooms`],
                    [`${bBeds.length} beds`],
                    [bFree ? `${bFree} free` : 'Full', bFree ? 'free' : 'full'],
                    ...(bDue ? [[`${bDue} overdue`, 'due']] : []),
                  ]} />
                </View>
              )}

              {blk.sections.map((sec, si) => {
                const sBeds = sec.total.flatMap((r) => r.beds);
                const sFree = sBeds.filter((b) => b.state === 'free').length;
                const sDue = sBeds.filter((b) => b.state === 'overdue').length;
                const isFolded = foldedFloors.has(sec.key) && show === 'all' && !query;
                return (
                  <View key={sec.key} style={[si > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border, borderStyle: 'dashed' }]}>
                    <View style={styles.floorHead}>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => toggleFold(sec.key)} style={{ flex: 1, gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Icon name={isFolded ? 'chevron-forward' : 'chevron-down'} size={15} color={theme.colors.textMuted} />
                          <Text style={[styles.floorTitle, { color: theme.colors.text }]}>{sec.title}</Text>
                        </View>
                        {sec.total.length ? (
                          <View style={{ marginLeft: 21 }}>
                            <Pills theme={theme} items={[
                              [`${sec.total.length} room${sec.total.length === 1 ? '' : 's'}`],
                              [`${sBeds.length} beds`],
                              [sFree ? `${sFree} free` : 'Full', sFree ? 'free' : 'full'],
                              ...(sDue ? [[`${sDue} overdue`, 'due']] : []),
                            ]} />
                          </View>
                        ) : (
                          <Text style={[styles.summaryText, { color: theme.colors.textMuted, marginLeft: 21 }]}>no rooms yet</Text>
                        )}
                      </TouchableOpacity>
                      {sec.group && (
                        <TouchableOpacity onPress={() => setAddRoomAt({ group: sec.group, floor: sec.floor })}
                          accessibilityLabel={`Add room ${sec.floor ? `on ${sec.floor.name}` : `in ${sec.group.name}`}`}
                          style={[styles.squareBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                          <Icon name="add" size={18} color={theme.colors.text} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {!isFolded && (sec.rooms.length ? (
                      <View style={viewMode === 'compact' ? styles.miniGrid : { gap: 12, paddingBottom: 12 }}>
                        {sec.rooms.map((r) => (viewMode === 'compact'
                          ? <RoomMini key={r._id} room={r} theme={theme} onBed={(b) => openBed(r, b)} onEdit={() => setEditingRoom(r)} />
                          : <RoomCard key={r._id} room={r} theme={theme} onBed={(b) => openBed(r, b)} onEdit={() => setEditingRoom(r)}
                              onAddBed={() => handleSetCapacity(r, r.capacity + 1)} onRemoveBed={() => handleRemoveBed(r)} />
                        ))}
                      </View>
                    ) : sec.group && show === 'all' && !query ? (
                      <TouchableOpacity
                        onPress={() => setAddRoomAt({ group: sec.group, floor: sec.floor })}
                        style={[styles.firstRoomBtn, { borderColor: theme.colors.border }]}>
                        <Icon name="add" size={14} color={theme.colors.textSecondary} />
                        <Text style={[styles.summaryText, { color: theme.colors.textSecondary, fontWeight: '600' }]}>
                          Add the first room {sec.floor ? `on ${sec.floor.name}` : `in ${sec.group.name}`}
                        </Text>
                      </TouchableOpacity>
                    ) : null)}
                  </View>
                );
              })}
            </View>
          );
        })}

        {rooms.length === 0 && !loading ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, alignItems: 'center', gap: 8 }]}>
            <Icon type="material" name="door-open" size={28} color={theme.colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No rooms yet</Text>
            <Text style={[styles.summaryText, { color: theme.colors.textMuted, textAlign: 'center' }]}>
              Add your buildings, floors and rooms in Setup. They'll show up here with every bed.
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Setup')} style={[styles.addTenantBtn, { alignSelf: 'stretch', marginBottom: 0, marginTop: 6 }]}>
              <Text style={styles.addTenantText}>Set up rooms</Text>
            </TouchableOpacity>
          </View>
        ) : sections.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              {query ? `No room or tenant matches “${search.trim()}”.` : show === 'free' ? 'Every bed is taken here.' : show === 'overdue' ? 'Nobody is overdue. 🎉' : 'No rooms here'}
            </Text>
          </View>
        ) : null}

        {/* Legend */}
        <View style={styles.legend}>
          {[['Available', '#10B981'], ['Occupied', '#3B82F6'], ['Leaving', '#F59E0B'], ['Overdue', '#EF4444']].map(([t, c]) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, borderWidth: 1.5, borderColor: c }} />
              <Text style={[styles.summaryText, { color: theme.colors.textMuted }]}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Add Tenant Modal */}
      <AddMemberModal
        visible={addTenantOpen}
        biz={biz}
        roomId={selectedRoomId}
        onClose={() => setAddTenantOpen(false)}
        onMemberAdded={fetchRoomsData}
      />
      <AddRoomModal
        visible={Boolean(addRoomAt)}
        biz={biz}
        group={addRoomAt?.group}
        floor={addRoomAt?.floor}
        existing={rooms}
        onClose={() => setAddRoomAt(null)}
        onSaved={fetchRoomsData}
      />
      <EditRoomModal
        visible={Boolean(editingRoom)}
        biz={biz}
        room={editingRoom}
        groups={sortedGroups}
        onClose={() => setEditingRoom(null)}
        onSaved={fetchRoomsData}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bedWrap: { flexBasis: '47%', flexGrow: 1 },
  bedRemove: { position: 'absolute', top: -7, left: -7, width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  firstRoomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', marginBottom: 12 },
  headTitle: { fontSize: 24, fontWeight: '600' },
  headSub: { fontSize: 14, marginTop: 2, marginBottom: 14 },
  addTenantBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 10, backgroundColor: '#10B981', marginBottom: 14 },
  addTenantText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  chipScroll: { gap: 6, paddingBottom: 12 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '600' },
  toolRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 8, borderWidth: 1 },
  segmentActive: { shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 13, fontWeight: '700' },
  countGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  countBox: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 48, borderRadius: 12 },
  countDot: { width: 10, height: 10, borderRadius: 3 },
  countLabel: { flex: 1, fontSize: 13.5, fontWeight: '500' },
  countValue: { fontSize: 18, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryText: { fontSize: 13 },
  summaryLink: { fontSize: 13, fontWeight: '700' },
  block: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingTop: 4, marginBottom: 14 },
  blockHead: { paddingVertical: 10, gap: 6, borderBottomWidth: 1, marginBottom: 2 },
  blockTitle: { fontSize: 16, fontWeight: '700' },
  floorHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  floorTitle: { fontSize: 15, fontWeight: '700' },
  squareBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  roomCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 12 },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doorBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  roomTitle: { fontSize: 15.5, fontWeight: '700' },
  roomSub: { fontSize: 12.5 },
  addBedBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 28, paddingHorizontal: 9, borderRadius: 7, borderWidth: 1, alignSelf: 'flex-start' },
  addBedText: { fontSize: 12, fontWeight: '600' },
  bedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bedName: { fontSize: 14, fontWeight: '700', marginTop: 4, textAlign: 'center', alignSelf: 'stretch' },
  bedState: { fontSize: 12, fontWeight: '600', textAlign: 'center', alignSelf: 'stretch' },
  bedAmount: { fontSize: 13, marginTop: 4, textAlign: 'center', alignSelf: 'stretch' },
  bedFlag: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 6, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  bedFlagText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 12 },
  miniTile: { flexBasis: '46%', flexGrow: 1, borderWidth: 1, borderLeftWidth: 3, borderRadius: 14, padding: 12, gap: 9 },
  miniNo: { fontSize: 17, fontWeight: '800' },
  miniBeds: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  miniBed: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  miniBedText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
  miniFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  miniTrack: { height: 5, borderRadius: 99, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, paddingVertical: 8 },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 40,
  },
  pageHeader: {
    marginBottom: 14,
  },
  pageTitleWrap: {
    marginBottom: 10,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pageTitleSub: {
    fontSize: 16,
    fontWeight: '500',
  },
  pageSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  pageActions: {
    flexDirection: 'row',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  toolbarCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  viewModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  toolbarLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 2,
  },
  segmentBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentBtnText: {
    fontSize: 11.5,
  },
  floorsScrollWrap: {
    marginBottom: 10,
  },
  floorsScroll: {
    gap: 6,
  },
  floorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  floorChipText: {
    fontSize: 12,
  },
  freeCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  freeCountBadgeText: {
    color: '#10B981',
    fontSize: 10.5,
    fontWeight: '700',
  },
  bedChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  bedChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
  bedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bedChipLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  bedChipCount: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionsContainer: {
    gap: 14,
  },
  floorSection: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  floorHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  floorSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  floorStatsPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  statPillText: {
    fontSize: 11,
  },
  occupancyBarTrack: {
    height: 3,
    width: '100%',
  },
  occupancyBarFill: {
    height: '100%',
  },
  roomsList: {
    padding: 10,
    gap: 10,
  },
  roomCardInner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  roomCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  roomNo: {
    fontSize: 15,
    fontWeight: '700',
  },
  roomCapacity: {
    fontSize: 11.5,
    marginTop: 1,
  },
  capBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bedsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bedTile: {
    minWidth: '47%',
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  bedTileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  bedNumber: {
    fontSize: 11,
    fontWeight: '700',
  },
  bedFreeText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  tenantName: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  overdueText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  leavingText: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  bedsCompactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  compactBedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  compactBedChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
});
