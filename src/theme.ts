// Single source for colors, spacing and type. Text/background pairs below meet
// WCAG AA contrast (4.5:1) for normal text.

export const colors = {
  primary: '#0F5C6E',
  primaryPressed: '#0B4755',
  primarySoft: '#E3F1F4',
  background: '#F3F6F8',
  frame: '#DDE5EA',
  surface: '#FFFFFF',
  border: '#D5DEE4',
  text: '#14232B',
  textMuted: '#4F5F69',
  textOnPrimary: '#FFFFFF',
  overlay: 'rgba(15, 30, 38, 0.5)',

  danger: '#B42318',
  dangerSoft: '#FDECEA',
  warning: '#8A4B00',
  warningSoft: '#FFF3DC',
  success: '#1D6B3A',
  successSoft: '#E6F4EA',
  info: '#1F4E8C',
  infoSoft: '#E8F0FB',
  neutral: '#3E4C55',
  neutralSoft: '#EDF1F4',
} as const;

export type Tone = 'danger' | 'warning' | 'success' | 'info' | 'neutral' | 'primary';

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  success: { fg: colors.success, bg: colors.successSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  neutral: { fg: colors.neutral, bg: colors.neutralSoft },
  primary: { fg: colors.primary, bg: colors.primarySoft },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const fontSize = {
  caption: 12,
  small: 14,
  body: 16,
  title: 18,
  heading: 22,
  display: 28,
} as const;

/** Minimum touch target (Apple HIG / WCAG 2.5.5). */
export const MIN_TOUCH = 44;

/** On desktop browsers the app is shown as a centered phone-width column. */
export const MAX_CONTENT_WIDTH = 480;

export const cardShadow = {
  boxShadow: '0px 1px 3px rgba(15, 30, 38, 0.08)',
} as const;
