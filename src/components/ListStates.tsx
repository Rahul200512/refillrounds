import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors, fontSize, spacing } from '@/theme';
import { AppButton } from './AppButton';

// The three non-data states every list and screen can be in.

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite" testID="loading-state">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite" testID="error-state">
      <Ionicons name="cloud-offline-outline" size={36} color={colors.danger} />
      <Text style={styles.title}>Couldn&apos;t load data</Text>
      <Text style={styles.text}>{message}</Text>
      {onRetry && <AppButton label="Try again" icon="refresh" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  icon = 'checkmark-circle-outline',
}: {
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.container} testID="empty-state">
      <Ionicons name={icon} size={36} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  text: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
