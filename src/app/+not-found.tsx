import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/ListStates';
import { colors, spacing } from '@/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <EmptyState icon="compass-outline" title="Page not found" message="This link doesn't match any screen in RefillRounds." />
      <AppButton label="Go to dashboard" icon="home-outline" onPress={() => router.replace('/')} testID="not-found-home" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
});
