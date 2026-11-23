import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// The LocalSaaS logo: the house mark (assets/brand/logo.png, rendered from the web's brand.jsx) and the word
export const BRAND_IMAGES = {
  logo: require('../../assets/brand/logo.png'),
  hero: require('../../assets/brand/hero.png'),
  hostel: require('../../assets/brand/hostel.png'),
  tuition: require('../../assets/brand/tuition.png'),
  gym: require('../../assets/brand/gym.png'),
  mess: require('../../assets/brand/mess.png'),
};

export default function Logo({ size = 30, wordSize }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Image source={BRAND_IMAGES.logo} style={{ width: size, height: size }} />
      <Text style={[styles.word, { color: theme.colors.text, fontSize: wordSize || size * 0.72 }]}>
        Local<Text style={{ color: theme.colors.primary }}>SaaS</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontWeight: '800', letterSpacing: -0.4 },
});
