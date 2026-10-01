import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';
import { AppButton } from './AppButton';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Extra content such as a reason field or a list of choices. */
  children?: ReactNode;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  confirmDisabled?: boolean;
  loading?: boolean;
  /** Error from the last attempt, shown above the buttons. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Cross-platform confirmation dialog. React Native's Alert.alert does not
 * support buttons on web, so every confirmation in the app uses this instead.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  children,
  confirmLabel,
  confirmVariant = 'primary',
  confirmDisabled = false,
  loading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onCancel} accessibilityLabel="Close dialog" />
        <View style={styles.dialog} role="dialog" aria-modal accessibilityViewIsModal aria-label={title} testID="confirm-modal">
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {children}
            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            <AppButton label="Cancel" variant="ghost" onPress={onCancel} disabled={loading} style={styles.action} testID="confirm-modal-cancel" />
            <AppButton
              label={confirmLabel}
              variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
              onPress={onConfirm}
              disabled={confirmDisabled}
              loading={loading}
              style={styles.action}
              testID="confirm-modal-confirm"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  body: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  error: {
    fontSize: fontSize.small,
    color: colors.danger,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  action: {
    minWidth: 110,
  },
});
