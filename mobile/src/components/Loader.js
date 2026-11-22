import React, { useEffect, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet, AccessibilityInfo, SafeAreaView, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { BRAND_IMAGES } from './Logo';
import TopBar from './TopBar';

// true when the phone asks for less motion; loaders then stay still
function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduce);
    return () => sub?.remove?.();
  }, []);
  return reduce;
}

// one value that runs 0 → 1 forever
function useLoop(duration, easing = Easing.linear) {
  const reduce = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return undefined;
    const anim = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [v, duration, easing, reduce]);
  return v;
}

// The LocalSaaS loader: the logo with a purple arc turning around it, and a label with bouncing dots.
// `page` fills the screen (app start); otherwise it sits inline.
export default function Loader({ label = 'Loading', page = false }) {
  const { theme } = useTheme();
  const spin = useLoop(900);
  const breathe = useLoop(1800, Easing.inOut(Easing.ease));
  const dots = useLoop(1200);
  const size = page ? 78 : 64;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.9, 1] });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[styles.wrap, page && styles.page, page && { backgroundColor: theme.colors.background }]}>
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.card }]}>
        {/* the turning arc: two coloured sides of a circle border */}
        <Animated.View
          style={[
            styles.arc,
            {
              width: size + 8,
              height: size + 8,
              borderRadius: (size + 8) / 2,
              borderTopColor: theme.colors.primary,
              borderRightColor: theme.colors.primaryBorder,
              transform: [{ rotate }],
            },
          ]}
        />
        <Animated.Image source={BRAND_IMAGES.logo} style={{ width: page ? 30 : 24, height: page ? 30 : 24, transform: [{ scale }] }} />
      </View>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
        {[0, 1, 2].map((i) => {
          const start = i * 0.12;
          const lift = dots.interpolate({ inputRange: [0, start, start + 0.2, start + 0.4, 1], outputRange: [0, 0, -3, 0, 0], extrapolate: 'clamp' });
          const fade = dots.interpolate({ inputRange: [0, start, start + 0.2, start + 0.4, 1], outputRange: [0.25, 0.25, 1, 0.25, 0.25], extrapolate: 'clamp' });
          return <Animated.View key={i} style={[styles.dot, { backgroundColor: theme.colors.primary, opacity: fade, transform: [{ translateY: lift }] }]} />;
        })}
      </View>
    </View>
  );
}

// A small turning arc, the same as the loader's ring: for buttons and inline waits
export function Spinner({ size = 18, color, track }) {
  const { theme } = useTheme();
  const spin = useLoop(800);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const c = color || theme.colors.primary;
  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={{
        width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(2, size / 8),
        borderColor: track || 'rgba(127, 127, 127, 0.22)', borderTopColor: c, borderRightColor: c,
        transform: [{ rotate }],
      }}
    />
  );
}

// A placeholder block with a soft light sweeping across, shown where content is about to appear
export function Skeleton({ height = 16, width = '100%', radius = 8, style }) {
  const { theme } = useTheme();
  const sweep = useLoop(1500, Easing.bezier(0.4, 0, 0.2, 1));
  const [w, setW] = useState(0);
  const x = sweep.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ height, width, borderRadius: radius, backgroundColor: theme.isDark ? '#1A2335' : '#E8EBF2', overflow: 'hidden' }, style]}>
      {w > 0 && (
        <Animated.View
          style={{
            position: 'absolute', top: 0, bottom: 0, width: w * 0.6,
            backgroundColor: theme.isDark ? 'rgba(124, 102, 255, 0.10)' : 'rgba(255, 255, 255, 0.75)',
            transform: [{ translateX: x }],
          }}
        />
      )}
    </View>
  );
}

// A card-shaped group of skeleton lines, for lists and dashboards
export function SkeletonCard({ lines = 2, avatar = false, height, style }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, minHeight: height }, style]}>
      {avatar && <Skeleton width={40} height={40} radius={20} />}
      <View style={{ flex: 1, gap: 9 }}>
        <Skeleton width="55%" height={14} />
        {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} width={i === lines - 1 ? '35%' : '85%'} height={11} />)}
      </View>
    </View>
  );
}

// A whole screen of placeholders shaped like the page that is loading, so the layout
// doesn't jump and no "nothing here yet" message flashes before the data arrives
export function ScreenSkeleton({ navigation, kind = 'list' }) {
  const { theme } = useTheme();
  const tile = (key, h = 84) => (
    <View key={key} style={[styles.tile, { height: h, backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <Skeleton width="50%" height={11} />
      <Skeleton width="70%" height={20} />
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <TopBar navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} scrollEnabled={false}>
        <Skeleton width={kind === 'dashboard' ? 90 : 130} height={24} />
        {kind === 'dashboard' && (
          <>
            <Skeleton width={160} height={13} />
            <View style={styles.row}><Skeleton height={42} radius={10} style={{ flex: 1 }} /><Skeleton height={42} radius={10} style={{ flex: 1 }} /></View>
            <View style={styles.grid}>{[0, 1, 2, 3].map((i) => tile(i, 104))}</View>
            <SkeletonCard lines={2} height={86} />
            <SkeletonCard lines={3} avatar />
            <SkeletonCard lines={1} avatar />
          </>
        )}
        {kind === 'list' && (
          <>
            <View style={styles.row}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={56} radius={12} style={{ flex: 1 }} />)}</View>
            <Skeleton height={44} radius={10} />
            {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} lines={2} avatar />)}
          </>
        )}
        {kind === 'rooms' && (
          <>
            <Skeleton height={44} radius={10} />
            <View style={styles.row}>{[0, 1, 2].map((i) => <Skeleton key={i} width={96} height={34} radius={17} />)}</View>
            <View style={styles.grid}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={48} radius={12} style={styles.half} />)}</View>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.tile, { gap: 12, backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Skeleton width="40%" height={16} />
                <View style={styles.grid}>{[0, 1, 2, 3].map((j) => <Skeleton key={j} height={96} radius={10} style={styles.half} />)}</View>
              </View>
            ))}
          </>
        )}
        {kind === 'reports' && (
          <>
            <Skeleton height={40} radius={10} />
            <Skeleton height={54} radius={12} />
            <View style={styles.grid}>{[0, 1, 2].map((i) => tile(i, 96))}</View>
            <Skeleton height={96} radius={14} />
            <View style={styles.row}>{[0, 1, 2].map((i) => <Skeleton key={i} height={38} radius={10} style={{ flex: 1 }} />)}</View>
            {[0, 1, 2].map((i) => <SkeletonCard key={i} lines={1} />)}
          </>
        )}
        {kind === 'setup' && (
          <>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.tile, { gap: 12, backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Skeleton width="55%" height={16} />
                <Skeleton width="80%" height={11} />
                <View style={styles.row}><Skeleton width={120} height={36} radius={10} /><Skeleton width={110} height={36} radius={10} /></View>
                {[0, 1].map((j) => <SkeletonCard key={j} lines={1} avatar />)}
              </View>
            ))}
          </>
        )}
        {kind === 'attendance' && (
          <>
            <Skeleton height={40} radius={10} />
            <Skeleton height={96} radius={12} />
            <Skeleton height={86} radius={12} />
            {[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={0} avatar />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 40, paddingHorizontal: 16 },
  page: { flex: 1 },
  ring: { alignItems: 'center', justifyContent: 'center', shadowColor: '#3D27B8', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  arc: { position: 'absolute', borderWidth: 3.5, borderColor: 'transparent' },
  labelRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  label: { fontSize: 14, fontWeight: '500', marginRight: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, marginBottom: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  row: { flexDirection: 'row', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  half: { flexBasis: '47%', flexGrow: 1 },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10, justifyContent: 'center' },
});
