import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { fullName, medLabel } from '@/domain/format';
import { HOLD_RESOLUTIONS } from '@/domain/orderStatus';
import { formatCurrency } from '@/domain/refills';
import { validateReason } from '@/domain/validation';
import type { Medication, Order, Resident } from '@/models';
import { errorMessage, usePharmacy } from '@/state/PharmacyProvider';
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';
import { AppButton } from './AppButton';
import { ConfirmModal } from './ConfirmModal';
import { TextField } from './TextField';

interface OrderActionsProps {
  order: Order;
  medication?: Medication;
  resident?: Resident;
}

type Dialog = 'approve' | 'deny' | 'resolve' | null;

/**
 * The buttons for a blocked order (Approve / Deny, or Resolve hold) and the
 * confirmation dialogs behind them. Used on the approvals list and order detail.
 */
export function OrderActions({ order, medication, resident }: OrderActionsProps) {
  const { approveOrder, denyOrder, resolveHold } = usePharmacy();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [resolution, setResolution] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const what = `${medication ? medLabel(medication) : 'this medication'}${resident ? ` for ${fullName(resident)}` : ''}`;

  const open = (next: Dialog) => {
    setReason('');
    setReasonError(undefined);
    setResolution(null);
    setError(null);
    setDialog(next);
  };

  const close = () => {
    if (!busy) setDialog(null);
  };

  const submit = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setDialog(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onDeny = () => {
    const problem = validateReason(reason);
    setReasonError(problem);
    if (!problem) submit(() => denyOrder(order.id, reason.trim()));
  };

  const pendingApproval = order.approval?.state === 'pending';

  return (
    <>
      <View style={styles.row}>
        {order.hold && (
          <AppButton
            label="Resolve hold"
            icon="checkmark-done"
            onPress={() => open('resolve')}
            style={styles.flex}
            testID={`resolve-${order.id}`}
            accessibilityLabel={`Resolve hold on ${what}`}
          />
        )}
        {pendingApproval && !order.hold && (
          <>
            <AppButton
              label="Deny"
              variant="danger"
              icon="close"
              onPress={() => open('deny')}
              style={styles.flex}
              testID={`deny-${order.id}`}
              accessibilityLabel={`Deny ${what}`}
            />
            <AppButton
              label="Approve"
              icon="checkmark"
              onPress={() => open('approve')}
              style={styles.flex}
              testID={`approve-${order.id}`}
              accessibilityLabel={`Approve ${what}`}
            />
          </>
        )}
      </View>

      <ConfirmModal
        visible={dialog === 'approve'}
        title="Approve high-cost medication?"
        message={`${what}. Estimated cost ${formatCurrency(order.approval?.estimatedCost ?? 0)}. The pharmacy will start filling it right away.`}
        confirmLabel="Approve"
        loading={busy}
        error={error}
        onConfirm={() => submit(() => approveOrder(order.id))}
        onCancel={close}
      />

      <ConfirmModal
        visible={dialog === 'deny'}
        title="Deny this order?"
        message={`${what} will not be filled. The reason is saved to the audit log and shared with the pharmacy.`}
        confirmLabel="Deny order"
        confirmVariant="danger"
        loading={busy}
        error={error}
        onConfirm={onDeny}
        onCancel={close}>
        <TextField
          label="Reason (required)"
          value={reason}
          onChangeText={(text) => {
            setReason(text);
            if (reasonError) setReasonError(validateReason(text));
          }}
          placeholder="e.g. Prescriber switching to a formulary alternative"
          error={reasonError}
          multiline
          maxLength={200}
          testID="deny-reason"
        />
      </ConfirmModal>

      <ConfirmModal
        visible={dialog === 'resolve'}
        title="Resolve hold"
        message={order.hold ? `${what} — ${order.hold.detail}. How was it resolved?` : undefined}
        confirmLabel="Resolve hold"
        confirmDisabled={!resolution}
        loading={busy}
        error={error}
        onConfirm={() => resolution && submit(() => resolveHold(order.id, resolution))}
        onCancel={close}>
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {(order.hold ? HOLD_RESOLUTIONS[order.hold.reason] : []).map((option, index) => {
            const selected = resolution === option;
            return (
              <Pressable
                key={option}
                onPress={() => setResolution(option)}
                accessibilityRole="radio"
                aria-checked={selected}
                accessibilityLabel={option}
                testID={`resolution-option-${index}`}
                style={[styles.choice, selected && styles.choiceSelected]}>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text style={styles.choiceText}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </ConfirmModal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  choices: {
    gap: spacing.sm,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceText: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
  },
});
