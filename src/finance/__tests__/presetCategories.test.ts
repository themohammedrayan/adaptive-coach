import { categoryAppearance, FALLBACK_CATEGORY_ICON, PRESET_CATEGORIES } from '../presetCategories';

describe('categoryAppearance', () => {
  it('falls back to the seeded default for a system category with nothing stored', () => {
    expect(categoryAppearance('sys-exp-food', null, null)).toEqual({ icon: '🍔', color: '#E0A800' });
  });

  it('lets a stored icon and colour override the seeded default', () => {
    expect(categoryAppearance('sys-exp-food', '🍕', '#123456')).toEqual({ icon: '🍕', color: '#123456' });
  });

  it('overrides each field independently', () => {
    // Stored icon, no stored colour → seeded colour still applies.
    expect(categoryAppearance('sys-exp-food', '🍕', null)).toEqual({ icon: '🍕', color: '#E0A800' });
    expect(categoryAppearance('sys-exp-food', null, '#123456')).toEqual({ icon: '🍔', color: '#123456' });
  });

  it('uses the neutral fallback for an unknown, user-created category', () => {
    expect(categoryAppearance('fin-abc123', null, null)).toEqual({
      icon: FALLBACK_CATEGORY_ICON,
      color: null,
    });
  });

  it('keeps a preset that deliberately has no colour as null rather than inventing one', () => {
    expect(categoryAppearance('sys-exp-uncategorised', null, null).color).toBeNull();
  });

  it('gives every seeded category an icon', () => {
    for (const preset of PRESET_CATEGORIES) {
      expect(preset.icon).not.toBe('');
    }
  });

  it('has no duplicate externalIds', () => {
    const ids = PRESET_CATEGORIES.map((c) => c.externalId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
