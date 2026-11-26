// Text and TextInput in Inter, the web app's font. metro.config.js swaps these in for every
// Text / TextInput the app's own code uses (see rn.js, Text.js, TextInput.js next to this file).
//
// A custom font can't pick its weight from fontWeight on every platform, so each weight is its
// own font file: fontWeight '600' becomes fontFamily 'Inter_600SemiBold' with a plain weight.
// The web only loads Inter 400–700, so 800/900 show as 700 there; we do the same to match.
import React, { createContext, forwardRef, useContext } from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet } from 'react-native';

export const INTER = {
  Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
};

const BY_WEIGHT = {
  100: 'Inter_400Regular', 200: 'Inter_400Regular', 300: 'Inter_400Regular', 400: 'Inter_400Regular', normal: 'Inter_400Regular',
  500: 'Inter_500Medium', 600: 'Inter_600SemiBold',
  700: 'Inter_700Bold', 800: 'Inter_700Bold', 900: 'Inter_700Bold', bold: 'Inter_700Bold',
};

// nested <Text> keeps its parent's weight unless it sets its own
const Family = createContext(null);

function withInter(style, inherited) {
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily && !flat.fontFamily.startsWith('Inter_')) return { style, family: inherited }; // e.g. monospace
  const family = flat.fontWeight != null ? BY_WEIGHT[String(flat.fontWeight)] || 'Inter_400Regular' : inherited || 'Inter_400Regular';
  return { style: [style, { fontFamily: family, fontWeight: 'normal' }], family };
}

export const InterText = forwardRef(function InterText(props, ref) {
  const inherited = useContext(Family);
  const { style, family } = withInter(props.style, inherited);
  return (
    <Family.Provider value={family}>
      <RNText ref={ref} {...props} style={style} />
    </Family.Provider>
  );
});

export const InterTextInput = forwardRef(function InterTextInput(props, ref) {
  const { style } = withInter(props.style, null);
  return <RNTextInput ref={ref} {...props} style={style} />;
});
InterTextInput.State = RNTextInput.State;
