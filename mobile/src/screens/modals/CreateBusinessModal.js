import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useBiz } from '../../context/BizContext';
import { COLORS } from '../../constants/theme';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

export default function CreateBusinessModal({
  visible,
  onClose,
  onCreated,
}) {
  const { theme } = useTheme();
  const { createBusiness } = useBiz();

  const [name, setName] = useState('');
  const [type, setType] = useState('gym');
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Business name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const created = await createBusiness({
        name: name.trim(),
        type,
        upiId: upiId.trim() || undefined,
      });
      if (onCreated) onCreated(created);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create business');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Create Business Workspace"
      subtitle="Configure a workspace for your members and payments">
      <View>
        {error ? (
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
        ) : null}

        <Input
          label="Business / Workspace Name *"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Iron Fitness Gym"
          icon={<Icon name="business-outline" size={18} />}
        />

        {/* Business Category Selection */}
        <Text style={[styles.categoryLabel, { color: theme.colors.text }]}>Business Category</Text>
        <View style={styles.categoryGrid}>
          {Object.entries(COLORS.biz).map(([key, meta]) => {
            const selected = type === key;
            return (
              <TouchableOpacity
                key={key}
                activeOpacity={0.7}
                onPress={() => setType(key)}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: selected ? meta.soft : theme.colors.cardSubtle,
                    borderColor: selected ? meta.accent : theme.colors.borderSubtle,
                  },
                ]}>
                <View style={[styles.categoryIconWrap, { backgroundColor: meta.soft }]}>
                  <Icon name={meta.icon} size={22} color={meta.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.categoryTitle,
                      { color: selected ? meta.accent : theme.colors.text },
                    ]}>
                    {meta.label}
                  </Text>
                  <Text
                    style={[styles.categoryDesc, { color: theme.colors.textSecondary }]}
                    numberOfLines={2}>
                    {meta.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input
          label="UPI VPA ID (Optional)"
          value={upiId}
          onChangeText={setUpiId}
          placeholder="e.g. business@okaxis"
          hint="Members will receive direct tap-to-pay links on WhatsApp"
          icon={<Icon name="qr-code-outline" size={18} />}
        />

        <Button
          title="Create Workspace"
          variant="primary"
          loading={loading}
          onPress={handleSubmit}
          style={{ marginTop: 8 }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  errorText: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  categoryGrid: {
    gap: 8,
    marginBottom: 14,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    padding: 10,
    borderRadius: 10,
    gap: 12,
  },
  categoryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  categoryDesc: {
    fontSize: 11,
    marginTop: 2,
  },
});

