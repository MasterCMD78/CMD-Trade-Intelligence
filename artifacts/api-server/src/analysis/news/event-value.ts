/**
 * Numeric parsing for calendar values that arrive as provider-formatted
 * strings (e.g. "3.2%", "180K", "-0.4%", "2.1M"). Pure, isolated so both the
 * bias engine and (in future) any real provider adapter can reuse it.
 */

const SUFFIX_MULTIPLIER: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
};

/** Parses a value like "180K" or "3.2%" into a plain number, or null if unparsable. */
export function parseEventValue(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/-?\d+(\.\d+)?/);
  if (!match) return null;

  let value = parseFloat(match[0]);
  const suffix = trimmed.slice(match.index! + match[0].length).trim().toLowerCase().charAt(0);
  const multiplier = SUFFIX_MULTIPLIER[suffix];
  if (multiplier) value *= multiplier;

  return Number.isFinite(value) ? value : null;
}
