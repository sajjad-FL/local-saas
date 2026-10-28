import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Linking } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useBiz } from '../../context/BizContext';
import { api } from '../../api/api';
import Icon from '../../components/Icon';
import CreateBusinessModal from '../modals/CreateBusinessModal';

// No business yet (new sign-up, or the last one was deleted): same as the web's
// "Create Your Business Workspace" page
export function NoBusinessScreen() {
  const { theme } = useTheme();
  const { logout } = useAuth();
  const [open, setOpen] = useState(true);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}>
          <Icon name="business-outline" size={28} color={theme.colors.primary} />
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>Create Your Business Workspace</Text>
        <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>
          Select your business category to configure your workspace.
        </Text>
        <TouchableOpacity activeOpacity={0.8} onPress={() => setOpen(true)} style={[styles.btn, { backgroundColor: theme.colors.primary }]}>
          <Icon name="add" size={16} color="#FFFFFF" />
          <Text style={styles.btnText}>Create business</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={logout} style={styles.link}>
          <Text style={[styles.linkText, { color: theme.colors.textMuted }]}>Sign out</Text>
        </TouchableOpacity>
      </View>
      <CreateBusinessModal visible={open} onClose={() => setOpen(false)} />
    </SafeAreaView>
  );
}

// A business the platform admin has paused: why, since when, and who to contact
export function PausedBusinessScreen() {
  const { theme } = useTheme();
  const { logout } = useAuth();
  const { biz, businesses, switchBiz } = useBiz();
  const [support, setSupport] = useState(null);

  useEffect(() => {
    api('/me').then((me) => setSupport(me?.supportPhone || null)).catch(() => {});
  }, []);

  const since = biz?.suspendedAt
    && new Date(biz.suspendedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const others = businesses.filter((b) => b._id !== biz?._id);
  const wa = support
    && `https://wa.me/${support.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Hi, my business ${biz?.name} is paused. Please help me resume it.`)}`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.warningSoft }]}>
          <Icon name="pause-circle-outline" size={30} color={theme.colors.warningDark} />
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>Service paused</Text>
        <Text style={[styles.name, { color: theme.colors.text }]}>{biz?.name}{since ? ` · since ${since}` : ''}</Text>
        {biz?.suspendedReason ? (
          <Text style={[styles.reason, { color: theme.colors.text, borderColor: theme.colors.border }]}>“{biz.suspendedReason}”</Text>
        ) : null}
        <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>
          Your members, payments and history are safe. Everything comes back as soon as the service is resumed.
        </Text>
        {support ? (
          <View style={{ gap: 8, alignSelf: 'stretch' }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => Linking.openURL(wa)} style={[styles.btn, { backgroundColor: theme.colors.primary }]}>
              <Icon name="logo-whatsapp" size={16} color="#FFFFFF" />
              <Text style={styles.btnText}>Contact support on WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={() => Linking.openURL(`tel:${support}`)}
              style={[styles.btn, { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }]}>
              <Icon name="call-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.btnText, { color: theme.colors.text }]}>Call {support}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {others.length > 0 && (
          <View style={{ alignSelf: 'stretch', marginTop: 14, gap: 6 }}>
            <Text style={[styles.sub, { color: theme.colors.textMuted, marginBottom: 0 }]}>Your other businesses still work:</Text>
            {others.map((b) => (
              <TouchableOpacity key={b._id} onPress={() => switchBiz(b._id)}
                style={[styles.btn, { backgroundColor: theme.colors.cardSubtle, borderWidth: 1, borderColor: theme.colors.border }]}>
                <Text style={[styles.btnText, { color: theme.colors.text }]}>Open {b.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity onPress={logout} style={styles.link}>
          <Text style={[styles.linkText, { color: theme.colors.textMuted }]}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, justifyContent: 'center', padding: 16 },
  card: { borderWidth: 1, borderRadius: 16, padding: 22, alignItems: 'center' },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 19, fontWeight: '700', textAlign: 'center' },
  name: { fontSize: 14, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  reason: { fontSize: 13.5, fontStyle: 'italic', marginTop: 10, borderLeftWidth: 3, paddingLeft: 10, alignSelf: 'stretch' },
  sub: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8, marginBottom: 16 },
  btn: { flexDirection: 'row', gap: 7, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, alignSelf: 'stretch' },
  btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  link: { marginTop: 14, padding: 6 },
  linkText: { fontSize: 13, textDecorationLine: 'underline' },
});
