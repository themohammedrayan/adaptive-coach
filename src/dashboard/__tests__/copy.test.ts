import { projectedFinishCopy } from '../copy';

describe('projectedFinishCopy — Dashboard BRD §A3, §C AT4', () => {
  it('shows a neutral message with no date when null (stalled/gaining)', () => {
    const copy = projectedFinishCopy(null);
    expect(copy).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(copy).toBe("Trend is flat — see this week's note");
  });

  it('shows the projected date, prefixed "On this pace"', () => {
    expect(projectedFinishCopy('2026-09-01')).toBe('On this pace: ~2026-09-01');
  });
});
