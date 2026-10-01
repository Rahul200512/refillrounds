import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EmptyState } from '@/components/ListStates';
import { Screen, SectionTitle } from '@/components/Screen';
import { formatDate, formatDateTime } from '@/domain/dates';
import { useNow } from '@/hooks/useNow';
import { fullName, pluralize } from '@/domain/format';
import type { DeliveryItem, DeliveryItemStatus } from '@/models';
import { errorMessage, usePharmacy } from '@/state/PharmacyProvider';
import { colors, fontSize, MIN_TOUCH, radius, spacing, toneColors, type Tone } from '@/theme';

const CHOICES: { status: DeliveryItemStatus; label: string; icon: keyof typeof Ionicons.glyphMap; tone: Tone }[] = [
  { status: 'received', label: 'Received', icon: 'checkmark', tone: 'success' },
  { status: 'missing', label: 'Missing', icon: 'help', tone: 'danger' },
  { status: 'damaged', label: 'Damaged', icon: 'alert', tone: 'warning' },
];

export default function DeliveryScreen() {
  const { state, updateDeliveryItem, confirmDelivery } = usePharmacy();
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const now = useNow(30000);

  const delivery = state.delivery;
  if (!delivery) {
    return (
      <Screen>
        <EmptyState icon="cube-outline" title="No delivery scheduled today" />
      </Screen>
    );
  }

  const confirmed = Boolean(delivery.confirmedAt);
  const checked = delivery.items.filter((i) => i.status !== 'pending').length;
  const flagged = delivery.items.filter((i) => i.status === 'missing' || i.status === 'damaged');
  const allChecked = checked === delivery.items.length;

  const setStatus = async (item: DeliveryItem, status: DeliveryItemStatus) => {
    // Tapping the selected choice again clears it.
    const next = item.status === status ? 'pending' : status;
    setSavingItem(item.id);
    setItemError(null);
    try {
      await updateDeliveryItem(item.id, next);
    } catch (e) {
      setItemError(errorMessage(e));
    } finally {
      setSavingItem(null);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setConfirmError(null);
    try {
      await confirmDelivery();
      setConfirming(false);
    } catch (e) {
      setConfirmError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="delivery">
      <Card style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.slip}>Packing slip {delivery.packingSlipNumber}</Text>
          <Badge
            label={confirmed ? 'Confirmed' : 'Awaiting check-in'}
            tone={confirmed ? 'success' : 'info'}
            testID="delivery-status"
          />
        </View>
        <Text style={styles.meta}>
          {formatDate(delivery.date)} · {delivery.window}
        </Text>
        <Text style={styles.meta}>{delivery.route}</Text>
        <View style={styles.progressTrack} accessibilityLabel={`${checked} of ${delivery.items.length} items checked`}>
          <View style={[styles.progressFill, { width: `${(checked / delivery.items.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText} testID="delivery-progress">
          {checked} of {delivery.items.length} items checked
        </Text>
      </Card>

      {delivery.confirmedAt && (
        <View style={styles.done} testID="delivery-confirmed">
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <Text style={styles.doneText}>
            Confirmed by {delivery.confirmedBy} · {formatDateTime(delivery.confirmedAt, now)}
            {flagged.length > 0 ? `. ${pluralize(flagged.length, 'issue')} reported to the pharmacy.` : '.'}
          </Text>
        </View>
      )}

      <SectionTitle>Items</SectionTitle>
      {itemError && <Text style={styles.error}>{itemError}</Text>}
      {delivery.items.map((item) => {
        const resident = state.residents.find((r) => r.id === item.residentId);
        return (
          <Card key={item.id} testID={`delivery-item-${item.id}`} style={styles.item}>
            <Text style={styles.itemTitle}>{item.description}</Text>
            <Text style={styles.meta}>
              {item.quantity}
              {resident ? ` · ${fullName(resident)} (${resident.room})` : ''}
            </Text>
            {item.handlingNote && <Badge label={item.handlingNote} tone="info" icon="snow-outline" />}
            <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={`Status of ${item.description}`}>
              {CHOICES.map((choice) => {
                const selected = item.status === choice.status;
                const { fg, bg } = toneColors[choice.tone];
                return (
                  <Pressable
                    key={choice.status}
                    onPress={() => setStatus(item, choice.status)}
                    disabled={confirmed || savingItem === item.id}
                    accessibilityRole="radio"
                    aria-checked={selected}
                    accessibilityLabel={`${choice.label}: ${item.description}`}
                    testID={`delivery-${item.id}-${choice.status}`}
                    style={[
                      styles.choice,
                      selected && { backgroundColor: bg, borderColor: fg },
                      (confirmed || savingItem === item.id) && !selected && styles.choiceDisabled,
                    ]}>
                    <Ionicons name={choice.icon} size={16} color={selected ? fg : colors.textMuted} />
                    <Text style={[styles.choiceText, selected && { color: fg }]}>{choice.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        );
      })}

      {!confirmed && (
        <>
          {!allChecked && (
            <Text style={styles.hint}>Mark every item as received, missing or damaged to confirm the delivery.</Text>
          )}
          <AppButton
            label="Confirm delivery"
            icon="checkmark-done"
            onPress={() => {
              setConfirmError(null);
              setConfirming(true);
            }}
            disabled={!allChecked}
            testID="delivery-confirm"
          />
        </>
      )}

      <ConfirmModal
        visible={confirming}
        title="Confirm delivery?"
        message={
          flagged.length === 0
            ? `All ${delivery.items.length} items received. This signs off the packing slip.`
            : `${delivery.items.length - flagged.length} received and ${pluralize(flagged.length, 'item')} flagged. The pharmacy will be asked to resend flagged items.`
        }
        confirmLabel="Confirm delivery"
        loading={busy}
        error={confirmError}
        onConfirm={confirm}
        onCancel={() => !busy && setConfirming(false)}>
        {flagged.map((i) => (
          <Text key={i.id} style={styles.flagLine}>
            • {i.description}: {i.status}
          </Text>
        ))}
      </ConfirmModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  slip: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralSoft,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: fontSize.small,
    fontWeight: '600',
    color: colors.text,
  },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.successSoft,
  },
  doneText: {
    flex: 1,
    color: colors.success,
    fontWeight: '600',
    fontSize: fontSize.small,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  item: {
    gap: spacing.xs,
  },
  itemTitle: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  choices: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  choice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceDisabled: {
    opacity: 0.5,
  },
  choiceText: {
    fontSize: fontSize.small,
    fontWeight: '700',
    color: colors.textMuted,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  flagLine: {
    fontSize: fontSize.body,
    color: colors.text,
  },
});
