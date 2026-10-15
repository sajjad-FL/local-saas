import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function Badge({
  label,
  variant = 'default', // 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'gray' | 'default'
  size = 'md',        // 'sm' | 'md'
  icon,
  style,
  textStyle,
}) {
  const { theme } = useTheme();

  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: theme.colors.successSoft, text: theme.colors.successDark, border: '#A7F3D0' };
      case 'warning':
        return { bg: theme.colors.warningSoft, text: theme.colors.warningDark, border: '#FDE68A' };
      case 'danger':
        return { bg: theme.colors.dangerSoft, text: theme.colors.dangerDark, border: '#FECACA' };
      case 'info':
        return { bg: theme.colors.infoSoft, text: theme.colors.infoDark, border: '#BFDBFE' };
      case 'purple':
        return { bg: theme.colors.purpleSoft, text: theme.colors.purpleDark, border: '#DDD6FE' };
      case 'gray':
      default:
        return { bg: theme.colors.cardSubtle, text: theme.colors.textSecondary, border: theme.colors.borderSubtle };
    }
  };

  const colors = getColors();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingVertical: size === 'sm' ? 2 : 4,
          paddingHorizontal: size === 'sm' ? 6 : 8,
          borderRadius: theme.radius.sm,
        },
        style,
      ]}>
      {icon && <View style={styles.iconWrap}>{icon}</View>}
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontSize: size === 'sm' ? 10.5 : 11.5,
          },
          textStyle,
        ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  iconWrap: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
  },
});

