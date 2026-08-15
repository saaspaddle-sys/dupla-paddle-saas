import { noBcryptTruncation } from './no-bcrypt-truncation.validator';

describe('noBcryptTruncation', () => {
  it('accepts a regular ASCII password', () => {
    expect(noBcryptTruncation('password123')).toBe(true);
  });

  it('accepts exactly 72 ASCII bytes', () => {
    expect(noBcryptTruncation('a'.repeat(72))).toBe(true);
  });

  it('rejects more than 72 ASCII bytes', () => {
    expect(noBcryptTruncation('a'.repeat(73))).toBe(false);
  });

  it('rejects 72 accented characters (more than 72 UTF-8 bytes) even though they pass @MaxLength(72)', () => {
    // Cada 'á' son 2 bytes en UTF-8: 72 caracteres = 144 bytes.
    const password = 'á'.repeat(72);
    expect(password).toHaveLength(72);
    expect(noBcryptTruncation(password)).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(noBcryptTruncation(undefined)).toBe(false);
    expect(noBcryptTruncation(12345678)).toBe(false);
  });
});
