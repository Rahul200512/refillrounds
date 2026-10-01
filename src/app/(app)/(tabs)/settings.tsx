import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DemoNotice } from '@/components/DemoNotice';
import { Screen, SectionTitle } from '@/components/Screen';
import { APP_NAME, SESSION_TIMEOUT_MS } from '@/config';
import { formatDateTime } from '@/domain/dates';
import { useNow } from '@/hooks/useNow';
import { errorMessage, usePharmacy } from '@/state/PharmacyProvider';
import { useSession } from '@/state/SessionProvider';
import { colors, fontSize, MIN_TOUCH, spacing } from '@/theme';

type Dialog = 'reset' | 'signOut' | null;

export default function SettingsScreen() {
  const { session, signOut } = useSession();
  const { state, resetDemoData } = usePharmacy();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);
  const now = useNow(30000);

  const run = async (action: () => Promise<void>, onDone?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setDialog(null);
      onDone?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const open = (next: Dialog) => {
    setError(null);
    setDialog(next);
  };

  return (
    <Screen testID="settings">
      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={24} color={colors.primary} />
        </View>
        <View style={styles.profileBody}>
          <Text style={styles.name}>{session?.displayName}</Text>
          <Text style={styles.meta}>
            {session?.role} · {state.facility?.name}
          </Text>
          {session && <Text style={styles.meta}>Signed in {formatDateTime(session.signedInAt, now)}</Text>}
        </View>
      </Card>

      <SectionTitle>Workspace</SectionTitle>
      <Card style={styles.menu}>
        <MenuRow icon="cube-outline" label="Today's delivery check-in" href="/delivery" testID="menu-delivery" />
        <View style={styles.divider} />
        <MenuRow icon="list-outline" label="Audit log" href="/audit" testID="menu-audit" />
      </Card>

      <SectionTitle>Security</SectionTitle>
      <Card style={styles.securityCard}>
        <View style={styles.securityRow}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
          <Text style={styles.securityText}>
            Auto-lock after {SESSION_TIMEOUT_MS / 60000} minutes of inactivity
          </Text>
        </View>
        <View style={styles.securityRow}>
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
          <Text style={styles.securityText}>Every action is recorded in the audit log</Text>
        </View>
      </Card>
      <AppButton label="Sign out" icon="log-out-outline" variant="secondary" onPress={() => open('signOut')} testID="sign-out" />

      <SectionTitle>Demo</SectionTitle>
      {resetDone && (
        <Text style={styles.success} accessibilityLiveRegion="polite" testID="reset-done">
          Demo data was reset to its starting state.
        </Text>
      )}
      <AppButton label="Reset demo data" icon="refresh" variant="danger" onPress={() => open('reset')} testID="reset-demo" />

      <SectionTitle>About</SectionTitle>
      <Card style={styles.about} testID="about">
        <Text style={styles.aboutTitle}>
          {APP_NAME} <Text style={styles.version}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </Text>
        <DemoNotice />
        <Text style={styles.aboutText}>
          A mobile companion for long-term care nurses: request refills, clear pharmacy holds, approve high-cost
          medications and check in deliveries from the med cart instead of a desktop portal.
        </Text>
        <Text style={styles.aboutText}>
          Built with React Native (Expo SDK 57), Expo Router and TypeScript. Data goes through a typed service layer
          (PharmacyApi) that is mocked here and designed to be backed by an ASP.NET Core REST API.
        </Text>
        <Text style={styles.aboutText}>
          All residents, medications, staff and the facility are fictional. No real patient information is used.
        </Text>
      </Card>

      <ConfirmModal
        visible={dialog === 'signOut'}
        title="Sign out?"
        message="You'll need to sign in again to see resident information."
        confirmLabel="Sign out"
        loading={busy}
        error={error}
        onConfirm={() => run(signOut)}
        onCancel={() => !busy && setDialog(null)}
      />
      <ConfirmModal
        visible={dialog === 'reset'}
        title="Reset demo data?"
        message="All orders, approvals, delivery check-ins and audit entries go back to the starting demo state. You stay signed in."
        confirmLabel="Reset data"
        confirmVariant="danger"
        loading={busy}
        error={error}
        onConfirm={() => run(resetDemoData, () => setResetDone(true))}
        onCancel={() => !busy && setDialog(null)}
      />
    </Screen>
  );
}

function MenuRow({
  icon,
  label,
  href,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href: Href;
  testID: string;
}) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBody: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: fontSize.title,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  menu: {
    paddingVertical: spacing.xs,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH + 4,
  },
  menuPressed: {
    opacity: 0.6,
  },
  menuLabel: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  securityCard: {
    gap: spacing.md,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  securityText: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
  },
  success: {
    color: colors.success,
    fontWeight: '600',
    fontSize: fontSize.small,
  },
  about: {
    gap: spacing.md,
  },
  aboutTitle: {
    fontSize: fontSize.title,
    fontWeight: '800',
    color: colors.text,
  },
  version: {
    fontSize: fontSize.small,
    fontWeight: '400',
    color: colors.textMuted,
  },
  aboutText: {
    fontSize: fontSize.small,
    color: colors.text,
    lineHeight: 20,
  },
});
