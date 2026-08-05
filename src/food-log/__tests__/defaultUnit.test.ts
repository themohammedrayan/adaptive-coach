import { DEFAULT_UNITS } from '../constants';
import { inferDefaultUnitId } from '../defaultUnit';

describe('inferDefaultUnitId', () => {
  it('picks a piece-style unit for single items', () => {
    expect(inferDefaultUnitId('Boiled egg', DEFAULT_UNITS)).toBe('egg');
    expect(inferDefaultUnitId('egg', DEFAULT_UNITS)).toBe('egg');
    expect(inferDefaultUnitId('Chapati', DEFAULT_UNITS)).toBe('roti');
    expect(inferDefaultUnitId('Brown bread', DEFAULT_UNITS)).toBe('slice');
    expect(inferDefaultUnitId('Idli', DEFAULT_UNITS)).toBe('piece');
  });

  it('picks ml for liquids', () => {
    expect(inferDefaultUnitId('Milk', DEFAULT_UNITS)).toBe('ml');
    expect(inferDefaultUnitId('Orange juice', DEFAULT_UNITS)).toBe('ml');
    expect(inferDefaultUnitId('Coconut oil', DEFAULT_UNITS)).toBe('ml');
  });

  it('picks katori for the things that get served in one', () => {
    expect(inferDefaultUnitId('Toor dal', DEFAULT_UNITS)).toBe('katori');
    expect(inferDefaultUnitId('Chicken curry', DEFAULT_UNITS)).toBe('katori');
  });

  it('falls back to the first unit when nothing matches', () => {
    expect(inferDefaultUnitId('Protein powder', DEFAULT_UNITS)).toBe('gram');
    expect(inferDefaultUnitId('', DEFAULT_UNITS)).toBe('gram');
    expect(inferDefaultUnitId('   ', DEFAULT_UNITS)).toBe('gram');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(inferDefaultUnitId('  EGG  ', DEFAULT_UNITS)).toBe('egg');
  });

  it('matches on word boundaries, not substrings', () => {
    // "eggplant" is a vegetable weighed in grams, not a count of eggs.
    expect(inferDefaultUnitId('Eggplant', DEFAULT_UNITS)).toBe('gram');
    // "milkshake" should still read as a liquid via 'shake'.
    expect(inferDefaultUnitId('Banana milkshake', DEFAULT_UNITS)).toBe('ml');
  });

  it('never returns a unit the caller does not have', () => {
    const onlyGrams = DEFAULT_UNITS.filter((u) => u.id === 'gram');
    expect(inferDefaultUnitId('Boiled egg', onlyGrams)).toBe('gram');
  });

  it('falls back to gram when the unit list is empty', () => {
    expect(inferDefaultUnitId('Boiled egg', [])).toBe('gram');
  });
});
