import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { DEMO_NOTICE } from '@/config';
import { colors, fontSize, radius, spacing } from '@/theme';

export function DemoNotice() {
  return (
    <View style={styles.notice} accessibilityRole="text" testID="demo-notice">
      <Ionicons name="information-circle" size={18} color={colors.info} />
      <Text style={styles.text}>{DEMO_NOTICE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.info,
    fontWeight: '600',
  },
});
