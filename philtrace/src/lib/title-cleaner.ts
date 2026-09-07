export function cleanProjectTitle(raw: string): string {
  if (!raw) return 'DPWH Infrastructure Project';
  let s = raw.trim();

  // Strip generic bureaucratic program prefixes
  s = s.replace(/^(?:LOCAL|BASIC)\s+INFRASTRUCTURE\s+PROGRAM\s*(?:\([^)]+\))?\s*[:-]?\s*(?:BUILDINGS?\s+AND\s+OTHER\s+STRUCTURES\s*[:-]?\s*)?(?:MULTI[- ]?PURPOSE[/\w\s]*\s*[:-]?\s*)?/i, '');
  s = s.replace(/^(?:LOCAL|BASIC)\s+INFRASTRUCTURE\s+PROGRAM\s*(?:\([^)]+\))?\s*[:-]?\s*/i, '');
  s = s.replace(/^ORGANIZATIONAL\s+OUTCOME\s+\d+\s*[:-]\s*/i, '');
  s = s.replace(/^(?:ASSET\s+PRESERVATION|NETWORK\s+DEVELOPMENT|FLOOD\s+MANAGEMENT|CONVERGENCE\s+AND\s+SPECIAL\s+SUPPORT)\s*(?:PROGRAM|OF\s+NATIONAL\s+ROADS)?\s*[:-]\s*/i, '');
  s = s.replace(/^[-\s:]+/, '').trim();
  s = s.replace(/\s+/g, ' ');

  // If cleaning stripped too much, fallback to raw
  if (s.length < 5) s = raw.trim();

  return s;
}
