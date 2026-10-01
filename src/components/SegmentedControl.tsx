import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  testIDPrefix?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testIDPrefix = 'segment',
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.container} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            aria-selected={selected}
            accessibilityLabel={option.label}
            testID={`${testIDPrefix}-${option.value}`}
            style={[styles.segment, selected && styles.selected]}>
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.neutralSoft,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  selected: {
    backgroundColor: colors.surface,
    boxShadow: '0px 1px 2px rgba(15, 30, 38, 0.15)',
  },
  label: {
    fontSize: fontSize.small,
    fontWeight: '600',
    color: colors.textMuted,
  },
  selectedLabel: {
    color: colors.primary,
  },
});
