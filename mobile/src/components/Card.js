import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function Card({ children, style, onPress, activeOpacity = 0.75, bordered = true }) {
  const { theme } = useTheme();

  const cardStyle = [
    styles.card,
    {
      backgroundColor: theme.colors.card,
      borderColor: bordered ? theme.colors.border : 'transparent',
      borderRadius: theme.radius.card,
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={activeOpacity} onPress={onPress} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
});
