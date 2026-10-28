import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { useBiz } from '../context/BizContext';
import { useTheme } from '../context/ThemeContext';
import { BIZ_CONFIG } from '../constants/theme';
import Icon from './Icon';

export default function TopBar({
  title,
  navigation,
  rightAction,
  showThemeToggle = true,
}) {
  const { biz, businesses = [], switchBiz } = useBiz();
  const { theme, isDark, toggleTheme } = useTheme();
  const [bizPickerOpen, setBizPickerOpen] = useState(false);

  const bizType = biz?.type || 'gym';
  const typeConfig = BIZ_CONFIG[bizType] || BIZ_CONFIG.gym;
  const canGoBack = navigation?.canGoBack?.();

  return (
    <>
      <View
        style={[
          styles.topbar,
          {
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.border,
          },
        ]}>
        {/* Left: Back button OR Brand Mark & Title */}
        <View style={styles.brandWrapper}>
          {canGoBack ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.iconBtn, { borderColor: theme.colors.border }]}>
              <Icon name="arrow-back" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={businesses.length > 1 ? 0.7 : 1}
              onPress={() => businesses.length > 1 && setBizPickerOpen(true)}
              style={[
                styles.brandMark,
                { backgroundColor: typeConfig.gradient[0] },
              ]}>
              <Icon name={typeConfig.icon} size={17} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={businesses.length > 1 ? 0.7 : 1}
            onPress={() => businesses.length > 1 && setBizPickerOpen(true)}
            style={styles.brandInfo}>
            <Text style={[styles.brandName, { color: theme.colors.text }]} numberOfLines={1}>
              {biz?.name || 'LocalSaaS'}
            </Text>
            {businesses.length > 1 && (
              <Icon name="chevron-down" size={13} color={theme.colors.textMuted} />
            )}
            {canGoBack && title && (
              <>
                <Text style={[styles.brandSep, { color: theme.colors.textMuted }]}>/</Text>
                <Text style={[styles.brandBadge, { color: theme.colors.textMuted }]} numberOfLines={1}>
                  {title}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Right Actions */}
        <View style={styles.actions}>
          {showThemeToggle && (
            <TouchableOpacity
              onPress={toggleTheme}
              accessibilityLabel="Toggle Theme"
              style={[
                styles.themeBtn,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: 'transparent',
                },
              ]}>
              <Icon
                name={isDark ? 'sunny' : 'moon'}
                size={16}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          )}

          {rightAction}
        </View>
      </View>

      {/* Switch Business Dropdown Modal */}
      {businesses.length > 1 && (
        <Modal
          visible={bizPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setBizPickerOpen(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setBizPickerOpen(false)}>
            <View
              style={[
                styles.pickerCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}>
              <Text style={[styles.pickerTitle, { color: theme.colors.textMuted }]}>
                SWITCH WORKSPACE
              </Text>
              <ScrollView style={{ maxHeight: 240 }}>
                {businesses.map((b) => {
                  const isCurrent = b._id === biz?._id;
                  const bCfg = BIZ_CONFIG[b.type] || BIZ_CONFIG.gym;
                  return (
                    <TouchableOpacity
                      key={b._id}
                      onPress={async () => {
                        await switchBiz(b._id);
                        setBizPickerOpen(false);
                      }}
                      style={[
                        styles.pickerItem,
                        {
                          backgroundColor: isCurrent ? theme.colors.cardSubtle : 'transparent',
                        },
                      ]}>
                      <View
                        style={[
                          styles.smallBadge,
                          { backgroundColor: bCfg.gradient[0] },
                        ]}>
                        <Icon name={bCfg.icon} size={14} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.pickerItemName,
                            {
                              color: isCurrent ? theme.colors.primary : theme.colors.text,
                              fontWeight: isCurrent ? '700' : '500',
                            },
                          ]}>
                          {b.name}
                        </Text>
                        <Text style={[styles.pickerItemType, { color: theme.colors.textMuted }]}>
                          {bCfg.badge}
                        </Text>
                      </View>
                      {isCurrent && (
                        <Icon name="checkmark" size={16} color={theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topbar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  brandWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    fontSize: 15.5,
    fontWeight: '700',
    maxWidth: 220,
  },
  brandSep: {
    fontSize: 13,
  },
  brandBadge: {
    fontSize: 12,
    fontWeight: '400',
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 90 : 60,
    paddingHorizontal: 16,
  },
  pickerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    maxWidth: 320,
    alignSelf: 'flex-start',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  pickerTitle: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
  },
  smallBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemName: {
    fontSize: 13,
  },
  pickerItemType: {
    fontSize: 11,
  },
});

