import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ListStates';
import { formatDateTime } from '@/domain/dates';
import { useNow } from '@/hooks/useNow';
import type { AuditAction, AuditEntry } from '@/models';
import { errorMessage, usePharmacy } from '@/state/PharmacyProvider';
import { colors, fontSize, radius, spacing, toneColors, type Tone } from '@/theme';

const ACTION_STYLE: Record<AuditAction, { icon: keyof typeof Ionicons.glyphMap; tone: Tone; label: string }> = {
  signed_in: { icon: 'log-in-outline', tone: 'neutral', label: 'Signed in' },
  signed_out: { icon: 'log-out-outline', tone: 'neutral', label: 'Signed out' },
  session_locked: { icon: 'lock-closed-outline', tone: 'neutral', label: 'Session locked' },
  refill_requested: { icon: 'add-circle-outline', tone: 'info', label: 'Refill requested' },
  order_held: { icon: 'pause-circle-outline', tone: 'danger', label: 'Order held' },
  order_approved: { icon: 'checkmark-circle-outline', tone: 'success', label: 'Approved' },
  order_denied: { icon: 'close-circle-outline', tone: 'danger', label: 'Denied' },
  hold_resolved: { icon: 'checkmark-done-outline', tone: 'success', label: 'Hold resolved' },
  delivery_item_flagged: { icon: 'flag-outline', tone: 'warning', label: 'Item flagged' },
  delivery_confirmed: { icon: 'cube-outline', tone: 'success', label: 'Delivery confirmed' },
  demo_reset: { icon: 'refresh-outline', tone: 'neutral', label: 'Demo reset' },
};

/**
 * The audit log is server-owned data, so this screen fetches it directly
 * when opened instead of keeping it in the shared app state.
 */
export default function AuditLogScreen() {
  const { getAuditLog } = usePharmacy();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Bumping this number re-runs the fetch (used by "Try again" and pull-to-refresh).
  const [attempt, setAttempt] = useState(0);
  const now = useNow(30000);

  useEffect(() => {
    let cancelled = false;
    getAuditLog()
      .then((data) => {
        if (cancelled) return;
        setEntries(data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getAuditLog, attempt]);

  const retry = () => setAttempt((n) => n + 1);

  if (error && !entries) return <ErrorState message={error} onRetry={retry} />;
  if (!entries) return <LoadingState label="Loading audit log…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(e) => e.id}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        retry();
      }}
      ListHeaderComponent={
        <Text style={styles.intro}>Every sign-in, order action and delivery check-in, newest first.</Text>
      }
      ListEmptyComponent={<EmptyState icon="document-text-outline" title="No activity yet" />}
      renderItem={({ item }) => {
        const style = ACTION_STYLE[item.action];
        const { fg, bg } = toneColors[style.tone];
        return (
          <Card style={styles.row} testID={`audit-${item.action}`}>
            <View style={[styles.icon, { backgroundColor: bg }]}>
              <Ionicons name={style.icon} size={18} color={fg} />
            </View>
            <View style={styles.body}>
              <Text style={styles.label}>{style.label}</Text>
              <Text style={styles.summary}>{item.summary}</Text>
              <Text style={styles.meta}>
                {item.user} · {formatDateTime(item.at, now)}
              </Text>
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  intro: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summary: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  meta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
