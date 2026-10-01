import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EmptyState } from '@/components/ListStates';
import { Screen, SectionTitle } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { fullName, medLabel, pluralize } from '@/domain/format';
import { getOrderStatus, STATUS_LABELS } from '@/domain/orderStatus';
import {
  findOpenOrder,
  formatCurrency,
  getDaysRemaining,
  getRefillStatus,
  needsFacilityApproval,
  REFILL_LABELS,
  REFILL_TONES,
} from '@/domain/refills';
import { hasErrors, NOTE_MAX_LENGTH, validateRefill } from '@/domain/validation';
import { useNow } from '@/hooks/useNow';
import type { Priority } from '@/models';
import { errorMessage, usePharmacy } from '@/state/PharmacyProvider';
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

export default function RequestRefillScreen() {
  const { id, med: preselectedMedId } = useLocalSearchParams<{ id: string; med?: string }>();
  const { state, requestRefill } = usePharmacy();
  const now = useNow(5000);

  const resident = state.residents.find((r) => r.id === id);
  const meds = state.medications.filter((m) => m.residentId === id);

  const [selected, setSelected] = useState<string[]>(() =>
    preselectedMedId && meds.some((m) => m.id === preselectedMedId) && !findOpenOrder(preselectedMedId, state.orders, Date.now())
      ? [preselectedMedId]
      : [],
  );
  const [priority, setPriority] = useState<Priority>('routine');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!resident) {
    return (
      <Screen>
        <EmptyState icon="person-outline" title="Resident not found" />
        <AppButton label="Back to residents" variant="secondary" onPress={() => router.replace('/residents')} />
      </Screen>
    );
  }

  // Validate live only after the first submit attempt, so the form doesn't start out red.
  const errors = validateRefill({ medicationIds: selected, priority, note });
  const shownErrors = submitted ? errors : {};

  const toggle = (medId: string) => {
    setSelected((current) => (current.includes(medId) ? current.filter((x) => x !== medId) : [...current, medId]));
  };

  const review = () => {
    setSubmitted(true);
    if (!hasErrors(errors)) {
      setSubmitError(null);
      setConfirming(true);
    }
  };

  const send = async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const orderIds = await requestRefill({ residentId: resident.id, medicationIds: selected, priority, note });
      setConfirming(false);
      if (orderIds.length === 1) {
        router.replace({ pathname: '/order/[id]', params: { id: orderIds[0] } });
      } else {
        router.replace('/orders');
      }
    } catch (e) {
      setSubmitError(errorMessage(e));
      setBusy(false);
    }
  };

  const selectedMeds = meds.filter((m) => selected.includes(m.id));
  const approvalCount = selectedMeds.filter(needsFacilityApproval).length;

  return (
    <Screen testID="refill-screen">
      <Stack.Screen options={{ title: 'Request refill' }} />

      <Card style={styles.residentCard}>
        <Text style={styles.residentName}>{fullName(resident)}</Text>
        <Text style={styles.residentMeta}>Room {resident.room}</Text>
        <View style={styles.allergyLine}>
          <Ionicons
            name={resident.allergies.length ? 'warning' : 'checkmark-circle-outline'}
            size={16}
            color={resident.allergies.length ? colors.danger : colors.neutral}
          />
          <Text style={[styles.allergyText, resident.allergies.length > 0 && styles.allergyDanger]}>
            {resident.allergies.length ? `Allergies: ${resident.allergies.join(', ')}` : 'NKDA'}
          </Text>
        </View>
      </Card>

      <SectionTitle>1. Select medications</SectionTitle>
      {shownErrors.medications && (
        <Text style={styles.error} accessibilityLiveRegion="polite" testID="refill-error-medications">
          {shownErrors.medications}
        </Text>
      )}
      <View accessibilityRole="list" style={styles.medList}>
        {meds.map((med) => {
          const openOrder = findOpenOrder(med.id, state.orders, now);
          const isSelected = selected.includes(med.id);
          const status = getRefillStatus(med, state.orders, now);
          const days = getDaysRemaining(med, state.orders, now);
          return (
            <Pressable
              key={med.id}
              onPress={() => toggle(med.id)}
              disabled={Boolean(openOrder)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled: Boolean(openOrder) }}
              accessibilityLabel={`${medLabel(med)}${openOrder ? ', already ordered' : ''}`}
              testID={`refill-med-${med.id}`}
              style={[styles.medRow, isSelected && styles.medRowSelected, openOrder && styles.medRowDisabled]}>
              <Ionicons
                name={isSelected ? 'checkbox' : 'square-outline'}
                size={24}
                color={openOrder ? colors.border : isSelected ? colors.primary : colors.textMuted}
              />
              <View style={styles.medBody}>
                <Text style={styles.medName}>{medLabel(med)}</Text>
                <Text style={styles.medMeta}>
                  {med.form}
                  {med.fillType === 'prn' ? ` · ${pluralize(days, 'day')} left` : ''}
                </Text>
                <View style={styles.medBadges}>
                  {openOrder ? (
                    <Badge label={`Already ordered · ${STATUS_LABELS[getOrderStatus(openOrder, now)]}`} tone="info" />
                  ) : (
                    <Badge label={REFILL_LABELS[status]} tone={REFILL_TONES[status]} />
                  )}
                  {!openOrder && needsFacilityApproval(med) && (
                    <Badge label={`Needs facility approval · ${formatCurrency(med.costPerFill)}`} tone="warning" icon="shield-checkmark" />
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>2. Priority</SectionTitle>
      <SegmentedControl<Priority>
        options={[
          { value: 'routine', label: 'Routine' },
          { value: 'stat', label: 'STAT' },
        ]}
        value={priority}
        onChange={setPriority}
        accessibilityLabel="Order priority"
        testIDPrefix="priority"
      />
      <Text style={styles.hint}>
        {priority === 'stat'
          ? 'STAT: needed within hours. The pharmacist is paged and it goes on the next run.'
          : 'Routine: filled and sent with the next scheduled delivery.'}
      </Text>

      <SectionTitle>3. Note for pharmacist</SectionTitle>
      <TextField
        label={priority === 'stat' ? 'Clinical reason (required for STAT)' : 'Note (optional)'}
        value={note}
        onChangeText={setNote}
        placeholder={priority === 'stat' ? 'e.g. New wheezing episode, last vial used' : 'Anything the pharmacist should know'}
        multiline
        maxLength={NOTE_MAX_LENGTH}
        error={shownErrors.note}
        hint={`${note.length}/${NOTE_MAX_LENGTH}`}
        testID="refill-note"
      />

      <AppButton label="Review request" icon="arrow-forward" onPress={review} testID="refill-review" />

      <ConfirmModal
        visible={confirming}
        title={`Send ${pluralize(selectedMeds.length, 'refill request')}?`}
        confirmLabel="Send to pharmacy"
        loading={busy}
        error={submitError}
        onConfirm={send}
        onCancel={() => !busy && setConfirming(false)}>
        <View style={styles.summary}>
          <Text style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Resident: </Text>
            {fullName(resident)} · {resident.room}
          </Text>
          <Text style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Priority: </Text>
            {priority === 'stat' ? 'STAT' : 'Routine'}
          </Text>
          {selectedMeds.map((m) => (
            <Text key={m.id} style={styles.summaryMed}>
              • {medLabel(m)}
            </Text>
          ))}
          {note.trim() ? <Text style={styles.summaryLine}>“{note.trim()}”</Text> : null}
          {approvalCount > 0 && (
            <Text style={styles.summaryWarning}>
              {pluralize(approvalCount, 'item')} will wait for facility approval because of cost.
            </Text>
          )}
        </View>
      </ConfirmModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  residentCard: {
    gap: 2,
  },
  residentName: {
    fontSize: fontSize.title,
    fontWeight: '800',
    color: colors.text,
  },
  residentMeta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  allergyLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  allergyText: {
    flex: 1,
    fontSize: fontSize.small,
    fontWeight: '600',
    color: colors.neutral,
  },
  allergyDanger: {
    color: colors.danger,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  medList: {
    gap: spacing.sm,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: MIN_TOUCH,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  medRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  medRowDisabled: {
    backgroundColor: colors.neutralSoft,
  },
  medBody: {
    flex: 1,
    gap: 2,
  },
  medName: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  medMeta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  medBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  summary: {
    gap: spacing.xs,
  },
  summaryLine: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  summaryLabel: {
    fontWeight: '700',
  },
  summaryMed: {
    fontSize: fontSize.body,
    color: colors.text,
    paddingLeft: spacing.sm,
  },
  summaryWarning: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.warning,
    fontWeight: '600',
  },
});
