import {
  normalizeDni,
  normalizeDniInput,
  normalizeEmail,
  normalizeEmailInput,
  normalizeName,
  normalizeNameInput,
  normalizeText,
  normalizeTextInput,
} from './normalize';

describe('normalize', () => {
  describe('normalizeEmail / normalizeEmailInput', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  JUAN@Example.COM  ')).toBe('juan@example.com');
    });

    it('the unknown->unknown wrapper passes non-string values through untouched', () => {
      expect(normalizeEmailInput(42)).toBe(42);
      expect(normalizeEmailInput(undefined)).toBeUndefined();
      expect(normalizeEmailInput(null)).toBeNull();
    });
  });

  describe('normalizeDni / normalizeDniInput', () => {
    it('strips dots, spaces and dashes', () => {
      expect(normalizeDni('35.123.456')).toBe('35123456');
      expect(normalizeDni('35 123 456')).toBe('35123456');
      expect(normalizeDni('35-123-456')).toBe('35123456');
    });

    it('leaves other non-numeric characters alone: a dni with letters stays invalid instead of being silently normalized', () => {
      expect(normalizeDni('12345678X')).toBe('12345678X');
    });

    it('the unknown->unknown wrapper passes non-string values through untouched', () => {
      expect(normalizeDniInput(12345678)).toBe(12345678);
    });
  });

  describe('normalizeName / normalizeNameInput', () => {
    it('trims and collapses repeated inner spaces', () => {
      expect(normalizeName('  Juan   Román  ')).toBe('Juan Román');
    });

    it('the unknown->unknown wrapper passes non-string values through untouched', () => {
      expect(normalizeNameInput(null)).toBeNull();
    });
  });

  describe('normalizeText / normalizeTextInput', () => {
    it('only trims, leaving inner spaces alone', () => {
      expect(normalizeText('  caballeros  cuarta  ')).toBe(
        'caballeros  cuarta',
      );
    });

    it('the unknown->unknown wrapper passes non-string values through untouched', () => {
      expect(normalizeTextInput(undefined)).toBeUndefined();
    });
  });
});
