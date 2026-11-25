import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, ScrollView, StyleSheet, Modal as RNModal } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';

// The compact phone pattern shared by Money, Members and Enquiries (same as the web app):
// a one-line header (title, ⋯, one main button), the numbers in one slim strip,
// search with the filter button right after it, chips under it, and one line per person.

export function useTones() {
  const { theme } = useTheme();
  const c = theme.colors;
  const dark = theme.isDark;
  return {
    paid: { bg: dark ? 'rgba(52,211,153,0.14)' : '#DCFCE7', ink: dark ? '#34D399' : '#15803D' },
    late: { bg: dark ? 'rgba(248,113,113,0.16)' : '#FEE2E2', ink: dark ? '#F87171' : '#B91C1C' },
    due: { bg: dark ? 'rgba(251,191,36,0.16)' : '#FEF3C7', ink: dark ? '#FBBF24' : '#92400E' },
    none: { bg: dark ? 'rgba(148,163,184,0.14)' : '#F1F3F7', ink: c.textMuted },
  };
}

const useLine = () => {
  const { theme } = useTheme();
  return theme.isDark ? 'rgba(255,255,255,0.08)' : '#E2E5EC';
};

// 1. title · ⋯ · + Main
export function CompactHeader({ title, menu = [], mainLabel, onMain }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const line = useLine();
  const [open, setOpen] = useState(false);
  const items = menu.filter(Boolean);
  return (
    <View style={s.head}>
      <Text style={[s.h1, { color: c.text }]} numberOfLines={1}>{title}</Text>
      {items.length > 0 && (
        <TouchableOpacity accessibilityLabel="More" onPress={() => setOpen(true)} style={[s.more, { borderColor: line, backgroundColor: c.card }]}>
          <Icon name="ellipsis-horizontal" size={18} color={c.textSecondary} />
        </TouchableOpacity>
      )}
      {onMain ? (
        <TouchableOpacity onPress={onMain} style={[s.main, { backgroundColor: c.primary }]}>
          <Icon name="add" size={16} color="#fff" />
          <Text style={s.mainText}>{mainLabel}</Text>
        </TouchableOpacity>
      ) : null}
      <RNModal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.scrim} onPress={() => setOpen(false)}>
          <View style={[s.menu, { backgroundColor: c.card, borderColor: line }]}>
            {items.map((it) => (
              <TouchableOpacity key={it.label} onPress={() => { setOpen(false); it.go(); }} style={s.menuItem}>
                <View style={[s.menuIcon, { backgroundColor: c.cardSubtle }]}><Icon name={it.icon} size={15} color={c.textSecondary} /></View>
                <Text style={{ color: c.text, fontSize: 14.5, fontWeight: '500', flexShrink: 1 }}>{it.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </RNModal>
    </View>
  );
}

// 2. four numbers in one slim strip
export function NumberStrip({ items }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const line = useLine();
  return (
    <View style={[s.strip, { backgroundColor: c.card, borderColor: line }]}>
      {items.map((it, i) => {
        const Cell = it.onPress ? TouchableOpacity : View;
        return (
          <Cell
            key={it.label}
            onPress={it.onPress}
            accessibilityState={it.onPress ? { selected: !!it.on } : undefined}
            style={[s.cell, i < items.length - 1 && { borderRightWidth: 1, borderRightColor: line }, it.on && { backgroundColor: c.primarySoft }]}>
            <Text style={[s.cellLabel, { color: c.textMuted }]} numberOfLines={1}>{it.label}</Text>
            <Text style={[s.cellValue, { color: it.ink || c.text }]} numberOfLines={1} adjustsFontSizeToFit>{it.value}</Text>
          </Cell>
        );
      })}
    </View>
  );
}

// the white card that holds search, chips and rows
export function ListCard({ children, style }) {
  const { theme } = useTheme();
  const line = useLine();
  return <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: line }, style]}>{children}</View>;
}

// 3. search, then the filter button right after it
export function SearchFilter({ value, onChange, placeholder, filterOn, onFilter }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const line = useLine();
  return (
    <View style={s.searchRow}>
      <View style={[s.search, { borderColor: line, backgroundColor: c.card }]}>
        <Icon name="search" size={16} color={c.textMuted} />
        <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.textMuted} style={[s.searchInput, { color: c.text }]} />
        {value ? <TouchableOpacity onPress={() => onChange('')} accessibilityLabel="Clear search"><Icon name="close-circle" size={17} color={c.textMuted} /></TouchableOpacity> : null}
      </View>
      {onFilter ? (
        <TouchableOpacity accessibilityLabel="Filters" onPress={onFilter}
          style={[s.filterBtn, { borderColor: filterOn ? c.primary : line, backgroundColor: filterOn ? c.primarySoft : c.card }]}>
          <Icon name="options-outline" size={18} color={filterOn ? c.primary : c.textSecondary} />
          {filterOn ? <View style={[s.dot, { backgroundColor: c.primary }]}><Text style={s.dotText}>{filterOn}</Text></View> : null}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// 4. chips under the search
export function ChipRow({ options, value, onPick, small }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const line = useLine();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <TouchableOpacity key={o.id} onPress={() => onPick(o.id)} accessibilityState={{ selected: on }}
            style={[s.chip, small && { height: 28, paddingHorizontal: 10 }, { borderColor: on ? c.primary : line, backgroundColor: on ? c.primarySoft : c.card }]}>
            <Text style={{ fontSize: small ? 12 : 13, fontWeight: '600', color: on ? c.primaryDark : c.textSecondary }}>
              {o.label}{o.count != null ? <Text style={{ fontWeight: '500', opacity: 0.7 }}>{`  ${o.count}`}</Text> : null}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// 5. one line per person: name + tags | amount | one button
export function CompactRow({ title, tags = [], sub, amount, amountInk, amountSub, button, onPress, onLongPress, left, selected, last }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const line = useLine();
  const tones = useTones();
  return (
    <View style={[s.row, !last && { borderBottomWidth: 1, borderBottomColor: line }, selected && { backgroundColor: c.primarySoft }]}>
      <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={400} style={s.rowMain} accessibilityLabel={`Open ${title}`}>
        {left}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={[s.rowTitle, { color: c.text }]} numberOfLines={1}>{title}</Text>
          <View style={s.tags}>
            {tags.filter(Boolean).map((t) => (
              <View key={t.text} style={[s.tag, { backgroundColor: t.bg || tones[t.tone || 'none'].bg }]}>
                <Text style={[s.tagText, { color: t.ink || tones[t.tone || 'none'].ink }]} numberOfLines={1}>{t.text}</Text>
              </View>
            ))}
            {sub ? <Text style={[s.sub, { color: c.textMuted }]} numberOfLines={1}>{sub}</Text> : null}
          </View>
        </View>
      </Pressable>
      {amount != null && (
        <View style={s.amt}>
          <Text style={[s.amtText, { color: amountInk || c.text }]} numberOfLines={1}>{amount}</Text>
          {amountSub ? <Text style={[s.amtSub, { color: c.textMuted }]}>{amountSub}</Text> : null}
        </View>
      )}
      {button ? (
        <TouchableOpacity onPress={button.onPress} accessibilityLabel={button.a11y || button.label}
          style={[s.btn, button.primary ? { backgroundColor: c.primary } : { backgroundColor: c.card, borderWidth: 1, borderColor: line }]}>
          {button.icon ? <Icon name={button.icon} size={14} color={button.primary ? '#fff' : c.text} /> : null}
          <Text style={[s.btnText, { color: button.primary ? '#fff' : c.text }]}>{button.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// the small colour key under the list
export function ColorKey({ items }) {
  const { theme } = useTheme();
  const tones = useTones();
  return (
    <View style={s.key}>
      {items.map(([label, tone]) => (
        <View key={label} style={s.keyItem}>
          <View style={[s.keyDot, { backgroundColor: tones[tone].bg }]} />
          <Text style={{ fontSize: 11.5, color: theme.colors.textMuted }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  h1: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  more: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  main: { height: 38, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  mainText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scrim: { flex: 1, backgroundColor: 'rgba(15,23,42,0.25)', alignItems: 'flex-end', paddingTop: 110, paddingRight: 16 },
  menu: { width: 240, borderRadius: 14, borderWidth: 1, padding: 6, shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 10, borderRadius: 10 },
  menuIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  strip: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  cell: { flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 10, gap: 8 },
  cellLabel: { fontSize: 12, fontWeight: '600' },
  cellValue: { fontSize: 16, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8, marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  search: { flex: 1, height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 14.5, paddingVertical: 0 },
  filterBtn: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  dotText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { fontSize: 14.5, fontWeight: '600' },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden' },
  tag: { height: 18, paddingHorizontal: 6, borderRadius: 5, justifyContent: 'center', flexShrink: 0 },
  tagText: { fontSize: 10.5, fontWeight: '700' },
  sub: { fontSize: 11.5, marginLeft: 4, flexShrink: 1 },
  amt: { alignItems: 'flex-end' },
  amtText: { fontSize: 14.5, fontWeight: '800' },
  amtSub: { fontSize: 11 },
  btn: { height: 34, minWidth: 74, paddingHorizontal: 10, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  btnText: { fontSize: 13, fontWeight: '700' },
  key: { flexDirection: 'row', gap: 12, paddingTop: 6 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  keyDot: { width: 9, height: 9, borderRadius: 3 },
});
