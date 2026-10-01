import { Redirect, Stack } from 'expo-router';

import { ErrorState, LoadingState } from '@/components/ListStates';
import { PharmacyProvider, usePharmacy } from '@/state/PharmacyProvider';
import { useSession } from '@/state/SessionProvider';
import { colors } from '@/theme';

// Deep links (e.g. refreshing /order/123) still get the tabs underneath,
// so the back button always has somewhere to go.
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

/** Everything inside (app) requires a signed-in user. */
export default function AppLayout() {
  const { status } = useSession();
  if (status === 'restoring') return <LoadingState label="Checking your session…" />;
  if (status === 'signedOut') return <Redirect href="/login" />;

  return (
    <PharmacyProvider>
      <DataGate />
    </PharmacyProvider>
  );
}

/** Shows loading / error until the first data load succeeds, then the app. */
function DataGate() {
  const { state, reload } = usePharmacy();
  if (state.status === 'loading') return <LoadingState label="Loading your facility…" />;
  if (state.status === 'error') return <ErrorState message={state.error ?? 'Please try again.'} onRetry={reload} />;

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: true,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}>
      {/* The title is what the back button announces ("Home, back"), not the "(tabs)" group name. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
      <Stack.Screen name="resident/[id]/index" options={{ title: 'Resident' }} />
      <Stack.Screen name="resident/[id]/refill" options={{ title: 'Request refill' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
      <Stack.Screen name="refills-due" options={{ title: 'Refills due' }} />
      <Stack.Screen name="delivery" options={{ title: "Today's delivery" }} />
      <Stack.Screen name="audit" options={{ title: 'Audit log' }} />
    </Stack>
  );
}
