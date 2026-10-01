import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { pharmacyApi } from '@/api';
import { SESSION_TIMEOUT_MS } from '@/config';
import { toMs } from '@/domain/dates';
import type { Session } from '@/models';

type SessionStatus = 'restoring' | 'signedOut' | 'signedIn';

interface SessionContextValue {
  status: SessionStatus;
  session: Session | null;
  /** Message for the sign-in screen, e.g. why the user was signed out. */
  notice: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  handleUnauthorized: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const CHECK_INTERVAL_MS = 10 * 1000;
const KEEP_ALIVE_THROTTLE_MS = 15 * 1000;
const LOCKED_NOTICE = 'For security, you were signed out after 5 minutes of inactivity.';

export function isSessionExpired(lastActiveAt: number, now: number): boolean {
  return now - lastActiveAt >= SESSION_TIMEOUT_MS;
}

/**
 * Owns sign-in state and the inactivity auto-lock. Any touch, click, key press
 * or scroll counts as activity. Activity is also saved (throttled) so the
 * timeout still applies after a page refresh or when the app is reopened.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Set when a session starts or is restored; updated on every interaction.
  const lastActiveRef = useRef(0);
  const lastSavedRef = useRef(0);

  const endSession = useCallback((message: string | null) => {
    setSession(null);
    setStatus('signedOut');
    setNotice(message);
  }, []);

  // Restore a saved session on startup, unless it has already timed out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await pharmacyApi.getSession();
      if (cancelled) return;
      if (!saved) {
        endSession(null);
      } else if (isSessionExpired(toMs(saved.lastActiveAt), Date.now())) {
        await pharmacyApi.signOut('inactivity');
        if (!cancelled) endSession(LOCKED_NOTICE);
      } else {
        lastActiveRef.current = Date.now();
        setSession(saved);
        setStatus('signedIn');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endSession]);

  const markActive = useCallback(() => {
    const now = Date.now();
    lastActiveRef.current = now;
    if (now - lastSavedRef.current > KEEP_ALIVE_THROTTLE_MS) {
      lastSavedRef.current = now;
      pharmacyApi.keepAlive();
    }
  }, []);

  const lockIfIdle = useCallback(async () => {
    if (isSessionExpired(lastActiveRef.current, Date.now())) {
      await pharmacyApi.signOut('inactivity');
      endSession(LOCKED_NOTICE);
    }
  }, [endSession]);

  // While signed in: check for inactivity periodically and whenever the app returns to the foreground.
  useEffect(() => {
    if (status !== 'signedIn') return;
    const interval = setInterval(lockIfIdle, CHECK_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') lockIfIdle();
    });
    return () => {
      clearInterval(interval);
      appState.remove();
    };
  }, [status, lockIfIdle]);

  // On web, listen at the document level so keyboard and scroll count as activity.
  useEffect(() => {
    if (Platform.OS !== 'web' || status !== 'signedIn' || typeof document === 'undefined') return;
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((name) => document.addEventListener(name, markActive, { passive: true }));
    return () => events.forEach((name) => document.removeEventListener(name, markActive));
  }, [status, markActive]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      session,
      notice,
      signIn: async (username, password) => {
        const signedIn = await pharmacyApi.signIn(username, password);
        lastActiveRef.current = Date.now();
        lastSavedRef.current = Date.now();
        setNotice(null);
        setSession(signedIn);
        setStatus('signedIn');
      },
      signOut: async () => {
        await pharmacyApi.signOut('manual');
        endSession(null);
      },
      handleUnauthorized: () => endSession('Your session has ended. Please sign in again.'),
    }),
    [status, session, notice, endSession],
  );

  return (
    <SessionContext.Provider value={value}>
      {/* On native, observe touches without capturing them (returning false lets them through). */}
      <View
        style={styles.fill}
        onStartShouldSetResponderCapture={() => {
          if (Platform.OS !== 'web' && status === 'signedIn') markActive();
          return false;
        }}>
        {children}
      </View>
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
