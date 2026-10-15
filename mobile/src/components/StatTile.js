import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';

export default function StatTile({
  label,
  value,
  prefix,
  suffix,
  deltaText,
  deltaType = 'neutral', // 'success' | 'danger' | 'warning' | 'neutral'
  icon,
  iconBg = '#DBEAFE',
  iconColor = '#1E40AF',
  sparkline = null,
  borderColor = null,
  onPress,
}) {
  const { theme } = useTheme();

  const getDeltaBadgeStyle = () => {
    switch (deltaType) {
      case 'success':
        return { bg: theme.colors.successSoft, text: theme.colors.successDark };
      case 'danger':
        return { bg: theme.colors.dangerSoft, text: theme.colors.dangerDark };
      case 'warning':
        return { bg: theme.colors.warningSoft, text: theme.colors.warningDark };
      case 'neutral':
      default:
        return { bg: 'transparent', text: theme.colors.textSecondary };
    }
  };

  const deltaStyle = getDeltaBadgeStyle();
  const maxSparkline = sparkline ? Math.max(...sparkline, 1) : 1;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.75 : 1}
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: theme.colors.card,
          borderColor: borderColor || theme.colors.border,
          borderRadius: theme.radius.lg,
        },
      ]}>
      {/* Top Header */}
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          {icon}
        </View>
      </View>

      {/* Value Row with Sparkline */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: theme.colors.text }]}>
          {prefix}{typeof value === 'number' ? value.toLocaleString('en-IN') : value}{suffix}
        </Text>

        {sparkline && sparkline.length > 0 && (
          <View style={styles.sparklineWrap}>
            {sparkline.map((val, idx) => {
              const heightPct = Math.max(20, Math.min(100, Math.round((val / maxSparkline) * 100)));
              const isLast = idx === sparkline.length - 1;
              return (
                <View
                  key={idx}
                  style={[
                    styles.sparklineBar,
                    {
                      height: `${heightPct}%`,
                      backgroundColor: theme.colors.primary,
                      opacity: isLast ? 1 : 0.4 + idx * 0.25,
                    },
                  ]}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* Delta Row */}
      {deltaText ? (
        <View style={styles.deltaRow}>
          <View
            style={[
              styles.deltaBadge,
              {
                backgroundColor: deltaStyle.bg,
                paddingHorizontal: deltaType !== 'neutral' ? 6 : 0,
                paddingVertical: deltaType !== 'neutral' ? 2 : 0,
                borderRadius: theme.radius.xs,
              },
            ]}>
            {deltaType === 'success' && (
              <Icon name="trending-up" type="feather" size={11} color={deltaStyle.text} style={{ marginRight: 3 }} />
            )}
            {deltaType === 'danger' && (
              <Icon name="trending-down" type="feather" size={11} color={deltaStyle.text} style={{ marginRight: 3 }} />
            )}
            <Text style={[styles.deltaText, { color: deltaStyle.text }]}>
              {deltaText}
            </Text>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    width: '48.5%',
    justifyContent: 'space-between',
    minHeight: 114,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    flexShrink: 1,
  },
  sparklineWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 20,
    width: 32,
    marginLeft: 6,
  },
  sparklineBar: {
    flex: 1,
    marginHorizontal: 1.5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

