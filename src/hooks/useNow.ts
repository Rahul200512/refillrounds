import { useEffect, useState } from 'react';

/**
 * Current time that re-renders the component every `intervalMs`.
 * Order statuses are computed from time, so screens use this to stay live.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
