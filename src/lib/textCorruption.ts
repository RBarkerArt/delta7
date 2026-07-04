// Text corruption primitives — the shared way the room lets a string fray.
//
// Storm flicker, self-redacting docs, and instrument noise all reuse this, so
// the corruption reads the same across every surface. Promoted out of
// BreakRoomPanels.tsx (the clock's drift-glitch was the first caller).
//
// Recovery-id namespace conventions (agreed for the modal-interactivity waves,
// all riding the existing recoveredItems set — never a new tracking surface):
//   sign:day:${day}   — a signed observation-log line
//   pour:day:${day}   — the second cup poured that day
//   read:${variant}   — a papery artifact opened at least once (dog-ear trace)
//   lore:${slug}      — a hidden log unlocked by paying attention (e.g. acrostic)
// Pre-existing ids (note:day, vm:, fragment:, return:day, evidence:, catchup:day)
// live in dailyRecovery.ts and stay as they are.

const GLITCH_GLYPHS = '0189▒█/\\';

// A wider glyph set for corrupting arbitrary text (titles, labels) where the
// characters aren't digits — the storm-flicker title corruption and the
// self-redacting docs draw from this.
const TEXT_GLITCH_GLYPHS = '▓▒█/\\|<>#*§Δ7Ø';

/**
 * Corrupt a few digit characters of a string, leaving separators intact. Used
 * for the break-room clock's drift beats; the count of swaps is intentionally
 * small so the value stays legible as "almost right".
 */
export const corruptClockString = (value: string): string => {
  const chars = value.split('');
  const corruptions = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < corruptions; i += 1) {
    const idx = Math.floor(Math.random() * chars.length);
    if (/[0-9]/.test(chars[idx])) {
      chars[idx] = GLITCH_GLYPHS[Math.floor(Math.random() * GLITCH_GLYPHS.length)];
    }
  }
  return chars.join('');
};

/**
 * Corrupt a small number of non-space characters of an arbitrary string, for
 * momentary text glitches on titles/labels (storm flicker). `intensity` (0..1)
 * scales how many characters swap; separators/spaces are left intact so the
 * string keeps its shape and stays readable as "almost right". Deterministic in
 * count-per-call but random in placement, so successive calls flicker.
 */
export const corruptGlyphString = (value: string, intensity = 0.5): string => {
  const chars = value.split('');
  const nonSpace = chars.filter((c) => c.trim().length > 0).length;
  const swaps = Math.max(1, Math.round(nonSpace * 0.28 * Math.min(1, Math.max(0, intensity))));
  for (let i = 0; i < swaps; i += 1) {
    const idx = Math.floor(Math.random() * chars.length);
    if (chars[idx].trim().length === 0) continue;
    chars[idx] = TEXT_GLITCH_GLYPHS[Math.floor(Math.random() * TEXT_GLITCH_GLYPHS.length)];
  }
  return chars.join('');
};
