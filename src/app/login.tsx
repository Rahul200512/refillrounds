import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { DemoNotice } from '@/components/DemoNotice';
import { LoadingState } from '@/components/ListStates';
import { TextField } from '@/components/TextField';
import { APP_NAME, DEMO_USER, SESSION_TIMEOUT_MS } from '@/config';
import { hasErrors, validateLogin } from '@/domain/validation';
import { errorMessage } from '@/state/PharmacyProvider';
import { useSession } from '@/state/SessionProvider';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function LoginScreen() {
  const { status, notice, signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  if (status === 'restoring') return <LoadingState label="Checking your session…" />;
  if (status === 'signedIn') return <Redirect href="/" />;

  const submit = async () => {
    const found = validateLogin({ username, password });
    setErrors(found);
    setFormError(null);
    if (hasErrors(found)) return;
    setSubmitting(true);
    try {
      await signIn(username, password);
    } catch (e) {
      setFormError(errorMessage(e));
      setSubmitting(false);
    }
  };

  const fillDemo = () => {
    setUsername(DEMO_USER.username);
    setPassword(DEMO_USER.password);
    setErrors({});
    setFormError(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="medkit" size={30} color={colors.textOnPrimary} />
            </View>
            <Text style={styles.appName} accessibilityRole="header">
              {APP_NAME}
            </Text>
            <Text style={styles.tagline}>The nurse&apos;s pharmacy to-do list, in your pocket.</Text>
          </View>

          <DemoNotice />

          {notice && (
            <View style={styles.notice} accessibilityLiveRegion="polite" testID="session-notice">
              <Ionicons name="lock-closed" size={18} color={colors.warning} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}

          <View style={styles.form}>
            <TextField
              label="Username"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (errors.username) setErrors((e) => ({ ...e, username: undefined }));
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={errors.username}
              testID="login-username"
            />
            <TextField
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
              }}
              secureTextEntry
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              error={errors.password}
              testID="login-password"
            />
            {formError && (
              <Text style={styles.formError} accessibilityLiveRegion="assertive" testID="login-error">
                {formError}
              </Text>
            )}
            <AppButton label="Sign in" icon="log-in-outline" onPress={submit} loading={submitting} testID="login-submit" />
          </View>

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Demo credentials</Text>
            <Text style={styles.demoLine}>
              Username: <Text style={styles.mono}>{DEMO_USER.username}</Text>
            </Text>
            <Text style={styles.demoLine}>
              Password: <Text style={styles.mono}>{DEMO_USER.password}</Text>
            </Text>
            <Pressable
              onPress={fillDemo}
              accessibilityRole="button"
              accessibilityLabel="Fill in demo credentials"
              style={({ pressed }) => [styles.fillButton, pressed && styles.fillPressed]}
              testID="login-fill-demo">
              <Ionicons name="flash-outline" size={16} color={colors.primary} />
              <Text style={styles.fillText}>Fill demo credentials</Text>
            </Pressable>
          </View>

          <Text style={styles.footnote}>
            For security, sessions lock after {SESSION_TIMEOUT_MS / 60000} minutes of inactivity.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: fontSize.display,
    fontWeight: '800',
    color: colors.text,
  },
  tagline: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: {
    flex: 1,
    color: colors.warning,
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  form: {
    gap: spacing.md,
  },
  formError: {
    color: colors.danger,
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  demoBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  demoTitle: {
    fontSize: fontSize.small,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  demoLine: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: colors.text,
    fontWeight: '600',
  },
  fillButton: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  fillPressed: {
    opacity: 0.8,
  },
  fillText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: fontSize.small,
  },
  footnote: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
