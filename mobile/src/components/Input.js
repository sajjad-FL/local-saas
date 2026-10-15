import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  icon,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  multiline = false,
  numberOfLines = 1,
  editable = true,
  style,
  inputStyle,
}) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!secureTextEntry);

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, { color: theme.colors.text }]}>
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.colors.inputBg,
            borderColor: error
              ? theme.colors.danger
              : isFocused
              ? theme.colors.primary
              : theme.colors.inputBorder,
            borderRadius: theme.radius.md,
            minHeight: multiline ? 80 : 44,
          },
        ]}>
        {icon && (
          <View style={styles.iconWrap}>
            {React.cloneElement(icon, {
              color: isFocused ? theme.colors.primary : theme.colors.textMuted,
              size: 18,
            })}
          </View>
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.textInput,
            {
              color: theme.colors.text,
              fontSize: 14.5,
              paddingLeft: icon ? 0 : 12,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            inputStyle,
          ]}
        />

        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}>
            <Icon
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {hint && !error && (
        <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
          {hint}
        </Text>
      )}

      {error && (
        <Text style={[styles.error, { color: theme.colors.danger }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  iconWrap: {
    marginRight: 8,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
  },
  eyeBtn: {
    padding: 8,
  },
  hint: {
    fontSize: 11.5,
    marginTop: 4,
  },
  error: {
    fontSize: 11.5,
    marginTop: 4,
    fontWeight: '500',
  },
});

