/**
 * Format a PHP currency value with peso sign.
 * Uses M for millions, B for billions.
 */
export function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `₱${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `₱${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `₱${(value / 1_000).toFixed(2)}K`;
  }
  return `₱${value.toFixed(2)}`;
}

/**
 * Format a date using Philippine locale.
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Format distance in km.
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m away`;
  }
  return `${km.toFixed(1)} km away`;
}

/**
 * Clean contractor name by removing the ID suffix in parentheses.
 * e.g., "PRIME PAVE CONSTRUCTION (36597)" → "PRIME PAVE CONSTRUCTION"
 */
export function cleanContractorName(raw: string): string {
  return raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * Parse contractor raw string to extract individual contractor names.
 * Splits on "&", "/", "JOINT VENTURE" and cleans each.
 */
export function parseContractors(raw: string): string[] {
  const cleaned = cleanContractorName(raw);
  const parts = cleaned.split(/\s*(?:&|\/|JOINT\s+VENTURE)\s*/i);
  return parts.map(p => p.trim()).filter(p => p.length > 0);
}
