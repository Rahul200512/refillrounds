import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/ListStates';
import { SegmentedControl } from '@/components/SegmentedControl';
import { fullName, initials, matchesSearch, pluralize, unitName } from '@/domain/format';
import { getRefillStatus, isRefillDue } from '@/domain/refills';
import { useNow } from '@/hooks/useNow';
import { usePharmacy } from '@/state/PharmacyProvider';
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

export default function ResidentsScreen() {
  const { state } = usePharmacy();
  const now = useNow(30000);
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState('all');
  const [searchFocused, setSearchFocused] = useState(false);

  const unitOptions = [
    { value: 'all', label: 'All units' },
    ...(state.facility?.units ?? []).map((u) => ({ value: u.id, label: u.name.replace(' Wing', '') })),
  ];

  const residents = useMemo(
    () =>
      state.residents
        .filter((r) => (unit === 'all' || r.unitId === unit) && matchesSearch(r, query))
        .sort((a, b) => a.room.localeCompare(b.room)),
    [state.residents, unit, query],
  );

  const dueCount = (residentId: string) =>
    state.medications.filter((m) => m.residentId === residentId && isRefillDue(getRefillStatus(m, state.orders, now)))
      .length;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={residents}
      keyExtractor={(r) => r.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={[styles.search, searchFocused && styles.searchFocused]}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or room"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              accessibilityLabel="Search residents by name or room"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              testID="resident-search"
            />
          </View>
          <SegmentedControl
            options={unitOptions}
            value={unit}
            onChange={setUnit}
            accessibilityLabel="Filter by unit"
            testIDPrefix="unit-filter"
          />
          <Text style={styles.count}>{pluralize(residents.length, 'resident')}</Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyState icon="search-outline" title="No residents found" message="Try a different name, room or unit." />
      }
      renderItem={({ item }) => {
        const due = dueCount(item.id);
        return (
          <Card
            onPress={() => router.push({ pathname: '/resident/[id]', params: { id: item.id } })}
            accessibilityLabel={`${fullName(item)}, room ${item.room}${due ? `, ${pluralize(due, 'refill')} due` : ''}`}
            testID={`resident-row-${item.id}`}
            style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(item)}</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.name}>{fullName(item)}</Text>
              <Text style={styles.meta}>
                Room {item.room} · {unitName(state.facility, item.unitId)}
              </Text>
              <View style={styles.badges}>
                {item.allergies.length > 0 ? (
                  <Badge label={`${pluralize(item.allergies.length, 'allergy', 'allergies')}`} tone="danger" icon="warning" />
                ) : (
                  <Badge label="NKDA" tone="neutral" />
                )}
                {due > 0 && <Badge label={`${pluralize(due, 'refill')} due`} tone="warning" />}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
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
  header: {
    gap: spacing.md,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  searchFocused: {
    borderColor: colors.primary,
  },
  searchInput: {
    flex: 1,
    minHeight: MIN_TOUCH,
    fontSize: fontSize.body,
    color: colors.text,
    outlineWidth: 0,
  },
  count: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: fontSize.body,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
