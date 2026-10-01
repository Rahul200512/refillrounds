import type { Priority } from '@/models';

// Validators return a map of field -> message. An empty object means valid.
export type ValidationErrors<Field extends string> = Partial<Record<Field, string>>;

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

export const NOTE_MAX_LENGTH = 200;
export const REASON_MIN_LENGTH = 5;

export function validateLogin(input: { username: string; password: string }): ValidationErrors<'username' | 'password'> {
  const errors: ValidationErrors<'username' | 'password'> = {};
  if (!input.username.trim()) errors.username = 'Enter your username.';
  if (!input.password) errors.password = 'Enter your password.';
  return errors;
}

export function validateRefill(input: {
  medicationIds: string[];
  priority: Priority;
  note: string;
}): ValidationErrors<'medications' | 'note'> {
  const errors: ValidationErrors<'medications' | 'note'> = {};
  const note = input.note.trim();
  if (input.medicationIds.length === 0) errors.medications = 'Select at least one medication.';
  if (input.priority === 'stat' && note.length < REASON_MIN_LENGTH) {
    errors.note = 'STAT requests need a short clinical reason for the pharmacist.';
  } else if (note.length > NOTE_MAX_LENGTH) {
    errors.note = `Keep the note under ${NOTE_MAX_LENGTH} characters.`;
  }
  return errors;
}

/** Used for denying an approval: a reason is required for the audit trail. */
export function validateReason(reason: string): string | undefined {
  if (reason.trim().length < REASON_MIN_LENGTH) {
    return `Enter a reason (at least ${REASON_MIN_LENGTH} characters).`;
  }
  return undefined;
}
