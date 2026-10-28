import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Linking, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, remindMsg, waLink } from '../../api/api';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

export default function SendReminderModal({
  visible,
  member,
  biz,
  onClose,
}) {
  const { theme } = useTheme();
  const [statementUrl, setStatementUrl] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && member) {
      const balance = Number(member.balance || 0);
      setLoading(true);
      (async () => {
        let url = '';
        try {
          const share = await api(`/members/${member._id}/share`, { method: 'POST' });
          if (share?.token) {
            url = `https://app.example.com/s/${share.token}`;
          }
        } catch {
          // ignore
        }
        setStatementUrl(url);
        const msg = remindMsg(biz, member, balance, url);
        setCustomMsg(msg);
        setLoading(false);
      })();
    }
  }, [visible, member, biz]);

  const handleOpenWhatsApp = () => {
    if (!member?.phone) {
      Alert.alert('No Phone', 'This member does not have a phone number recorded.');
      return;
    }
    const url = waLink(member.phone, customMsg);
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open WhatsApp', 'Please ensure WhatsApp is installed on this device.');
    });
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(customMsg);
    Alert.alert('Copied', 'Reminder message copied to clipboard!');
  };

  if (!visible || !member) return null;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Send WhatsApp Reminder"
      subtitle={member ? `${member.name} (${rupees(member.balance || 0)} pending)` : ''}>
      <View>
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          Reminder includes the pending amount, your direct UPI payment link, and the member's verified statement link.
        </Text>

        <Input
          label="Message Preview (Editable)"
          value={customMsg}
          onChangeText={setCustomMsg}
          multiline
          numberOfLines={6}
          style={{ minHeight: 120 }}
        />

        <View style={{ gap: 8, marginTop: 4 }}>
          <Button
            title="Open in WhatsApp"
            variant="whatsapp"
            icon={<Icon name="logo-whatsapp" size={18} color="#FFFFFF" />}
            onPress={handleOpenWhatsApp}
          />

          <Button
            title="Copy Message"
            variant="outline"
            icon={<Icon name="copy-outline" size={16} color={theme.colors.text} />}
            onPress={handleCopy}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  infoText: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
});

