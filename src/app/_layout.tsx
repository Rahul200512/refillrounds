import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';

import { SessionProvider } from '@/state/SessionProvider';
import { colors, MAX_CONTENT_WIDTH } from '@/theme';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  // Load the icon font up front so icons never flash in as empty boxes on web.
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <SessionProvider>
        {/* On wide screens the app is a centered phone-width column. */}
        <View style={styles.frame}>
          <View style={styles.app}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(app)" />
              <Stack.Screen name="login" options={{ title: 'Sign in' }} />
              <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
            </Stack>
          </View>
        </View>
        <StatusBar style="dark" />
      </SessionProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? colors.frame : colors.background,
  },
  app: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    backgroundColor: colors.background,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0px 0px 24px rgba(15, 30, 38, 0.12)' } : null),
  },
});
