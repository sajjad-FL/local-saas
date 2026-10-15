import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';

export default function Modal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  position = 'bottom', // 'bottom' | 'center'
  maxHeight = '85%',
}) {
  const { theme } = useTheme();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={position === 'bottom' ? 'slide' : 'fade'}
      onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.backdrop, { backgroundColor: 'rgba(0, 0, 0, 0.65)' }]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[
                position === 'bottom' ? styles.sheetContainer : styles.dialogContainer,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  maxHeight,
                },
              ]}>
              {/* Header */}
              <View
                style={[
                  styles.header,
                  { borderBottomColor: theme.colors.borderSubtle },
                ]}>
                <View style={{ flex: 1 }}>
                  {title && (
                    <Text style={[styles.title, { color: theme.colors.text }]}>
                      {title}
                    </Text>
                  )}
                  {subtitle && (
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                      {subtitle}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Icon name="close" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Body */}
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                keyboardShouldPersistTaps="handled">
                {children}
              </ScrollView>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  dialogContainer: {
    width: '90%',
    alignSelf: 'center',
    marginVertical: 'auto',
    borderRadius: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 8,
  },
  body: {
    width: '100%',
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 32,
  },
});

