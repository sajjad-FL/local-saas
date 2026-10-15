import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { rupees, waLink, remindMsg } from '../api/api';
import { getRenewalThreshold, getPlanPillClass } from '../constants/gymData';
import Badge from './Badge';
import Icon from './Icon';

export default function MemberCard({
  member,
  biz,
  onPress,
  onCollect,
  onRemind,
}) {
  const { theme } = useTheme();

  const balance = Number(member.balance || 0);
  const isOwing = balance > 0;
  const isLeft = member.status === 'left';
  const isPaused = member.subscription?.status === 'paused';

  // Renewal calculation
  const nextRenewalDate = member.nextRenewal ? new Date(member.nextRenewal) : null;
  const daysLeft = nextRenewalDate
    ? Math.ceil((nextRenewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const threshold = getRenewalThreshold(daysLeft);
  const planPill = getPlanPillClass(member.planName);

  // Initials
  const initials = (member.name || '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'M';

  const handleWhatsApp = (e) => {
    e?.stopPropagation?.();
    if (onRemind) {
      onRemind(member);
      return;
    }
    const msg = remindMsg(biz, member, balance);
    Linking.openURL(waLink(member.phone, msg)).catch(console.warn);
  };

  const handleCollect = (e) => {
    e?.stopPropagation?.();
    if (onCollect) onCollect(member);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: isOwing ? '#FECACA' : theme.colors.border,
          borderRadius: theme.radius.lg,
        },
      ]}>
      {/* Top Details */}
      <View style={styles.topRow}>
        {/* Avatar */}
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: isLeft
                ? theme.colors.cardSubtle
                : isOwing
                ? '#FEE2E2'
                : '#D1FAE5',
            },
          ]}>
          <Text
            style={[
              styles.avatarText,
              {
                color: isLeft
                  ? theme.colors.textMuted
                  : isOwing
                  ? '#991B1B'
                  : '#065F46',
              },
            ]}>
            {initials}
          </Text>
        </View>

        {/* Name & Phone */}
        <View style={styles.metaCol}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
              {member.name}
            </Text>
            {isLeft && (
              <Badge label="Left" variant="gray" size="sm" style={{ marginLeft: 6 }} />
            )}
            {isPaused && (
              <Badge label="Paused" variant="warning" size="sm" style={{ marginLeft: 6 }} />
            )}
          </View>

          <Text style={[styles.phone, { color: theme.colors.textSecondary }]}>
            {member.phone || 'No phone recorded'}
          </Text>
        </View>

        {/* Balance Display */}
        <View style={styles.balanceCol}>
          <Text
            style={[
              styles.balanceAmt,
              {
                color: isOwing
                  ? theme.colors.danger
                  : balance < 0
                  ? theme.colors.primary
                  : theme.colors.successDark,
              },
            ]}>
            {isOwing ? rupees(balance) : balance < 0 ? `+${rupees(-balance)}` : 'All Paid'}
          </Text>
          <Text style={[styles.balanceSub, { color: theme.colors.textMuted }]}>
            {isOwing ? 'Due' : balance < 0 ? 'Advance' : 'Cleared'}
          </Text>
        </View>
      </View>

      {/* Badges / Meta row: Plan, Group/Room, Renewal */}
      <View style={styles.badgesRow}>
        {member.planName ? (
          <View
            style={[
              styles.pill,
              {
                backgroundColor: planPill.bg,
                borderColor: planPill.border,
              },
            ]}>
            <Text style={[styles.pillText, { color: planPill.text }]}>
              {member.planName}
            </Text>
          </View>
        ) : null}

        {member.groupId?.name ? (
          <View
            style={[
              styles.pill,
              {
                backgroundColor: theme.colors.cardSubtle,
                borderColor: theme.colors.borderSubtle,
              },
            ]}>
            <Text style={[styles.pillText, { color: theme.colors.textSecondary }]}>
              {member.groupId.name}
            </Text>
          </View>
        ) : null}

        {member.roomId?.roomNo ? (
          <View
            style={[
              styles.pill,
              {
                backgroundColor: '#ECFDF5',
                borderColor: '#A7F3D0',
              },
            ]}>
            <Text style={[styles.pillText, { color: '#065F46' }]}>
              Room {member.roomId.roomNo}
            </Text>
          </View>
        ) : null}

        {nextRenewalDate && !isLeft && (
          <View
            style={[
              styles.pill,
              {
                backgroundColor: threshold.bgSoft,
                borderColor: threshold.borderColor,
                marginLeft: 'auto',
              },
            ]}>
            <Icon
              name="time-outline"
              size={11}
              color={threshold.textColor}
              style={{ marginRight: 3 }}
            />
            <Text style={[styles.pillText, { color: threshold.textColor, fontWeight: '700' }]}>
              {threshold.label}
            </Text>
          </View>
        )}
      </View>

      {/* Quick Action Footer */}
      <View
        style={[
          styles.actionFooter,
          { borderTopColor: theme.colors.borderSubtle },
        ]}>
        {/* Quick WhatsApp Reminder Button */}
        {member.phone ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleWhatsApp}
            style={[
              styles.quickActionBtn,
              {
                backgroundColor: theme.colors.whatsappSoft,
                borderColor: '#86EFAC',
              },
            ]}>
            <Icon name="logo-whatsapp" size={13} color={theme.colors.whatsappDark} />
            <Text style={[styles.quickActionText, { color: theme.colors.whatsappDark }]}>
              {isOwing ? 'Send Reminder' : 'WhatsApp'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Quick Collect Payment Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleCollect}
          style={[
            styles.quickActionBtn,
            {
              backgroundColor: isOwing ? theme.colors.primaryLight : theme.colors.cardSubtle,
              borderColor: isOwing ? '#6EE7B7' : theme.colors.borderSubtle,
              marginLeft: 'auto',
            },
          ]}>
          <Icon
            name="cash-outline"
            size={13}
            color={isOwing ? theme.colors.primaryDark : theme.colors.text}
          />
          <Text
            style={[
              styles.quickActionText,
              { color: isOwing ? theme.colors.primaryDark : theme.colors.text },
            ]}>
            Collect Payment
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  metaCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    maxWidth: '80%',
  },
  phone: {
    fontSize: 12,
    marginTop: 2,
  },
  balanceCol: {
    alignItems: 'flex-end',
  },
  balanceAmt: {
    fontSize: 15,
    fontWeight: '700',
  },
  balanceSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 8,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  quickActionText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
});

