import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Same as the web app's Avatar: up to two initials on a soft colour picked from the name,
// so a person has the same colour everywhere.
export default function Avatar({ name, size = 32 }) {
  const initials = (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  let h = 0;
  for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `hsl(${h}, 75%, 91%)`,
          borderColor: `hsl(${h}, 60%, 80%)`,
        },
      ]}>
      <Text style={[styles.text, { color: `hsl(${h}, 65%, 26%)`, fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  text: {
    fontWeight: '700',
  },
});
