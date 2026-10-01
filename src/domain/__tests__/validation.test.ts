import { createSeedData } from '@/api/seed';
import { matchesSearch } from '../format';
import { hasErrors, NOTE_MAX_LENGTH, validateLogin, validateReason, validateRefill } from '../validation';
import { NOW } from '@/testUtils/testData';

describe('validateLogin', () => {
  it('requires both fields', () => {
    expect(validateLogin({ username: ' ', password: '' })).toEqual({
      username: 'Enter your username.',
      password: 'Enter your password.',
    });
    expect(hasErrors(validateLogin({ username: 'nurse', password: 'x' }))).toBe(false);
  });
});

describe('validateRefill', () => {
  it('requires at least one medication', () => {
    expect(validateRefill({ medicationIds: [], priority: 'routine', note: '' }).medications).toBeDefined();
  });

  it('allows a routine request with no note', () => {
    expect(validateRefill({ medicationIds: ['m1'], priority: 'routine', note: '' })).toEqual({});
  });

  it('requires a clinical reason for STAT', () => {
    expect(validateRefill({ medicationIds: ['m1'], priority: 'stat', note: 'hi' }).note).toBeDefined();
    expect(validateRefill({ medicationIds: ['m1'], priority: 'stat', note: 'New wheezing' })).toEqual({});
  });

  it('limits note length', () => {
    const note = 'x'.repeat(NOTE_MAX_LENGTH + 1);
    expect(validateRefill({ medicationIds: ['m1'], priority: 'routine', note }).note).toBeDefined();
  });
});

describe('validateReason', () => {
  it('requires a meaningful reason', () => {
    expect(validateReason('   ')).toBeDefined();
    expect(validateReason('no')).toBeDefined();
    expect(validateReason('Formulary alternative')).toBeUndefined();
  });
});

describe('matchesSearch', () => {
  const [eleanor] = createSeedData(NOW).residents;

  it('matches name or room, ignoring case', () => {
    expect(matchesSearch(eleanor, 'whitc')).toBe(true);
    expect(matchesSearch(eleanor, 'm-101')).toBe(true);
    expect(matchesSearch(eleanor, 'eleanor whit')).toBe(true);
    expect(matchesSearch(eleanor, 'zzz')).toBe(false);
    expect(matchesSearch(eleanor, '')).toBe(true);
  });
});
