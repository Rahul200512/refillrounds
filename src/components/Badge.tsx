import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { fontSize, radius, spacing, toneColors, type Tone } from '@/theme';

interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}

/** Status pill. Always includes text so meaning never depends on color alone. */
export function Badge({ label, tone = 'neutral', icon, testID }: BadgeProps) {
  const { fg, bg } = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]} testID={testID}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
});
