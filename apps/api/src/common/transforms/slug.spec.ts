import { SLUG_MAX_LENGTH, slugify } from './slug';

describe('slugify', () => {
  it('lowercases and joins words with single hyphens', () => {
    expect(slugify('Club Atletico Sarmiento')).toBe('club-atletico-sarmiento');
  });

  it('strips accents instead of dropping the letter', () => {
    expect(slugify('Club Ñandú')).toBe('club-nandu');
  });

  it('collapses runs of non-alphanumeric characters into one hyphen', () => {
    expect(slugify('Padel  &  Co.')).toBe('padel-co');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  ...Padel!  ')).toBe('padel');
  });

  it('caps the result at the maximum slug length', () => {
    const slug = slugify('a'.repeat(SLUG_MAX_LENGTH + 30));

    expect(slug).toHaveLength(SLUG_MAX_LENGTH);
  });

  // El recorte se hace antes de trimear los guiones, así que un corte que
  // cae justo sobre un separador no puede dejar un slug terminado en `-`.
  it('never ends in a hyphen when the cap truncates mid-separator', () => {
    const slug = slugify(`${'a'.repeat(SLUG_MAX_LENGTH)} zona norte`);

    expect(slug.endsWith('-')).toBe(false);
  });

  // El caller (`ClubsService`) tiene un fallback para este caso; lo que se
  // fija acá es que `slugify` no se lo invente por su cuenta.
  it('returns an empty string when nothing ASCII-alphanumeric survives', () => {
    expect(slugify('中文')).toBe('');
  });
});
