import { isValidBirthDate } from './is-valid-birth-date.validator';

const NOW = new Date('2026-06-15T10:30:00.000Z');

describe('isValidBirthDate', () => {
  it('accepts a past date within a reasonable range', () => {
    expect(isValidBirthDate('1990-05-20', NOW)).toBe(true);
  });

  it('accepts today', () => {
    expect(isValidBirthDate('2026-06-15', NOW)).toBe(true);
  });

  it('rejects a future date', () => {
    expect(isValidBirthDate('2026-06-16', NOW)).toBe(false);
  });

  it('rejects a non-string value', () => {
    expect(isValidBirthDate(undefined, NOW)).toBe(false);
    expect(isValidBirthDate(20260615, NOW)).toBe(false);
  });

  it('rejects a malformed date (NaN when parsed)', () => {
    expect(isValidBirthDate('not-a-date', NOW)).toBe(false);
  });

  it('accepts a date exactly 120 years back, at the same time of day', () => {
    // Regresión del off-by-hours: `limit` se lleva a medianoche UTC antes
    // de comparar, así que la hora de `now` (10:30 acá) no debe importar.
    expect(isValidBirthDate('1906-06-15', NOW)).toBe(true);
  });

  it('rejects a date more than 120 years back', () => {
    expect(isValidBirthDate('1906-06-14', NOW)).toBe(false);
  });
});
