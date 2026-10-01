import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/ListStates';
import { fullName, medLabel, pluralize } from '@/domain/format';
import { getDaysRemaining, getRefillStatus, isRefillDue, REFILL_LABELS, REFILL_TONES } from '@/domain/refills';
import { useNow } from '@/hooks/useNow';
import { usePharmacy } from '@/state/PharmacyProvider';
import { colors, fontSize, spacing } from '@/theme';

/** PRN medications at or under the refill threshold with no open order, most urgent first. */
export default function RefillsDueScreen() {
  const { state } = usePharmacy();
  const now = useNow(10000);

  const due = state.medications
    .map((med) => ({ med, status: getRefillStatus(med, state.orders, now), days: getDaysRemaining(med, state.orders, now) }))
    .filter((x) => isRefillDue(x.status))
    .sort((a, b) => a.days - b.days);

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={due}
      keyExtractor={(x) => x.med.id}
      ListHeaderComponent={
        <Text style={styles.intro}>
          As-needed (PRN) medications with 7 days of supply or less. Cycle-fill medications ship automatically.
        </Text>
      }
      ListEmptyComponent={<EmptyState title="No refills due" message="Every PRN medication has enough supply." />}
      renderItem={({ item: { med, status, days } }) => {
        const resident = state.residents.find((r) => r.id === med.residentId);
        return (
          <Card testID={`due-${med.id}`} style={styles.card}>
            <View style={styles.top}>
              <Text style={styles.title}>{medLabel(med)}</Text>
              <Badge label={REFILL_LABELS[status]} tone={REFILL_TONES[status]} />
            </View>
            {resident && (
              <Text style={styles.sub}>
                {fullName(resident)} · Room {resident.room}
              </Text>
            )}
            <Text style={styles.days}>{days === 0 ? 'No supply left' : `${pluralize(days, 'day')} of supply left`}</Text>
            <AppButton
              label="Request refill"
              variant="secondary"
              icon="add-circle-outline"
              onPress={() =>
                router.push({ pathname: '/resident/[id]/refill', params: { id: med.residentId, med: med.id } })
              }
              accessibilityLabel={`Request refill of ${medLabel(med)}${resident ? ` for ${fullName(resident)}` : ''}`}
              testID={`due-request-${med.id}`}
            />
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
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  intro: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  card: {
    gap: spacing.xs,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  sub: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  days: {
    fontSize: fontSize.small,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
