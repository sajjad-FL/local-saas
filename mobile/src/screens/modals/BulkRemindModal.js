import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { rupees, waLink, remindMsg } from '../../api/api';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Icon from '../../components/Icon';

export default function BulkRemindModal({ visible, title = 'who owe', people = [], biz, onClose }) {
  const { theme } = useTheme();

  // Initial status: those without phone are 'nophone'
  const [status, setStatus] = useState(() =>
    Object.fromEntries(people.filter((p) => !p.phone).map((p) => [p._id, 'nophone']))
  );
  const [messages, setMessages] = useState(() =>
    Object.fromEntries(people.map((p) => [p._id, p.message || remindMsg(biz, p, p.balance || 0)]))
  );

  const nextFrom = (st, from = 0) => {
    const order = [...people.slice(from), ...people.slice(0, from)];
    return order.find((p) => !st[p._id]) || null;
  };

  const [currentId, setCurrentId] = useState(() => nextFrom(status)?._id ?? null);
  const current = people.find((p) => p._id === currentId) || null;

  const reachable = people.filter((p) => p.phone).length;
  const sent = Object.values(status).filter((s) => s === 'sent').length;
  const skipped = Object.values(status).filter((s) => s === 'skipped').length;
  const done = !current;

  const mark = (state) => {
    const next = { ...status, [current._id]: state };
    setStatus(next);
    const i = people.findIndex((p) => p._id === current._id);
    setCurrentId(nextFrom(next, i + 1)?._id ?? null);
  };

  const handleSendCurrent = () => {
    if (!current?.phone) return;
    const msg = messages[current._id] || current.message;
    const url = waLink(current.phone, msg);
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open WhatsApp', 'Make sure WhatsApp is installed.');
    });
    mark('sent');
  };

  const currentIndex = current ? people.indexOf(current) + 1 : people.length;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={`Remind All · ${title}`}
      subtitle={`${sent} of ${reachable} sent${skipped ? ` · ${skipped} skipped` : ''}`}>
      <View>
        {/* Progress Bar */}
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.cardSubtle }]}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${reachable ? Math.round(((sent + skipped) / reachable) * 100) : 100}%`,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
        </View>

        {done ? (
          <View style={styles.doneContainer}>
            <View style={[styles.doneIconWrap, { backgroundColor: theme.colors.successSoft }]}>
              <Icon name="checkmark-circle" size={48} color={theme.colors.success} />
            </View>
            <Text style={[styles.doneTitle, { color: theme.colors.text }]}>All Done!</Text>
            <Text style={[styles.doneSub, { color: theme.colors.textSecondary }]}>
              {sent} reminder{sent === 1 ? '' : 's'} sent
              {skipped ? `, ${skipped} skipped` : ''}
              {people.length > reachable ? `, ${people.length - reachable} without phone number` : ''}.
            </Text>
            <Button
              title="Close"
              variant="primary"
              style={{ width: '100%', marginTop: 16 }}
              onPress={onClose}
            />
          </View>
        ) : (
          <View>
            <View style={styles.personHeader}>
              <View style={[styles.avatar, { backgroundColor: theme.colors.primaryLight }]}>
                <Text style={[styles.avatarText, { color: theme.colors.primaryDark }]}>
                  {(current.name || 'M')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.personName, { color: theme.colors.text }]}>
                  {current.name}
                </Text>
                <Text style={[styles.personMeta, { color: theme.colors.textSecondary }]}>
                  {current.phone} {current.note ? `· ${current.note}` : ''}
                </Text>
              </View>
              <Text style={[styles.stepText, { color: theme.colors.textMuted }]}>
                {currentIndex} / {people.length}
              </Text>
            </View>

            <Input
              label="WhatsApp Message (Editable)"
              value={messages[current._id] || ''}
              onChangeText={(text) => setMessages({ ...messages, [current._id]: text })}
              multiline
              numberOfLines={4}
              style={{ marginTop: 8 }}
            />

            <View style={styles.actionRow}>
              <Button
                title="Send WhatsApp"
                variant="whatsapp"
                icon={<Icon name="logo-whatsapp" size={16} color="#FFFFFF" />}
                onPress={handleSendCurrent}
                style={{ flex: 1.4 }}
              />
              <Button
                title="Skip"
                variant="outline"
                onPress={() => mark('skipped')}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  doneContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  doneIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  doneTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  doneSub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  personName: {
    fontSize: 15,
    fontWeight: '700',
  },
  personMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
});

