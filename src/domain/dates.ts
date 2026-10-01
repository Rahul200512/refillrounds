// Small date helpers. Formatting is done by hand (not Intl) so output is the
// same on web, iOS, Android and in Jest.

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function toMs(iso: string): number {
  return new Date(iso).getTime();
}

/** Local calendar day as YYYY-MM-DD, used to detect stale demo data. */
export function toDateKey(ms: number): string {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Midnight (local time) of the day containing `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "2:05 PM" */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

/** "Wed, Oct 1" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Today, 2:05 PM", "Yesterday, 9:00 AM" or "Mon, Sep 29, 9:00 AM" */
export function formatDateTime(iso: string, now: number): string {
  const dayDiff = Math.round((startOfDay(now) - startOfDay(toMs(iso))) / DAY_MS);
  if (dayDiff === 0) return `Today, ${formatTime(iso)}`;
  if (dayDiff === 1) return `Yesterday, ${formatTime(iso)}`;
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** "just now", "5 min ago", "3 h ago", or a date for anything older than a day. */
export function formatRelative(iso: string, now: number): string {
  const diff = now - toMs(iso);
  if (diff < MINUTE_MS) return 'just now';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} min ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} h ago`;
  return formatDateTime(iso, now);
}
