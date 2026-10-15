import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function Button({
  title,
  onPress,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'danger' | 'whatsapp' | 'ghost'
  size = 'md',        // 'sm' | 'md' | 'lg'
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
}) {
  const { theme } = useTheme();

  const getBackgroundColor = () => {
    if (disabled) return theme.colors.cardSubtle;
    switch (variant) {
      case 'primary':
        return theme.colors.primary;
      case 'secondary':
        return theme.colors.cardSubtle;
      case 'outline':
        return 'transparent';
      case 'danger':
        return theme.colors.danger;
      case 'whatsapp':
        return theme.colors.whatsapp;
      case 'ghost':
        return 'transparent';
      default:
        return theme.colors.primary;
    }
  };

  const getBorderColor = () => {
    if (variant === 'outline') {
      return disabled ? theme.colors.borderSubtle : theme.colors.border;
    }
    return 'transparent';
  };

  const getTextColor = () => {
    if (disabled) return theme.colors.textMuted;
    switch (variant) {
      case 'primary':
        return '#FFFFFF';
      case 'secondary':
        return theme.colors.text;
      case 'outline':
        return theme.colors.text;
      case 'danger':
        return '#FFFFFF';
      case 'whatsapp':
        return '#FFFFFF';
      case 'ghost':
        return theme.colors.primary;
      default:
        return '#FFFFFF';
    }
  };

  const getHeight = () => {
    switch (size) {
      case 'sm':
        return 34;
      case 'lg':
        return 50;
      default:
        return 44;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return 13;
      case 'lg':
        return 16;
      default:
        return 14.5;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 1 : 0,
          height: getHeight(),
          borderRadius: size === 'sm' ? theme.radius.sm : theme.radius.md,
          paddingHorizontal: size === 'sm' ? 12 : 16,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          {title ? (
            <Text
              style={[
                styles.text,
                {
                  color: getTextColor(),
                  fontSize: getFontSize(),
                  fontWeight: '600',
                },
                textStyle,
              ]}>
              {title}
            </Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginRight: 8,
  },
  text: {
    textAlign: 'center',
  },
});

