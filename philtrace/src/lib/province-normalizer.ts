/**
 * Province name normalizer.
 * DPWH API returns DEO names like "Pampanga 1st DEO", "Metro Manila 3rd DEO".
 * This normalizes them to match PSA PSGC province names.
 */

/** Static fallback mapping for edge cases */
const FALLBACK_MAP: Record<string, string> = {
  'Tacloban City': 'Leyte',
  'Metro Manila 1st': 'Metropolitan Manila',
  'Metro Manila 2nd': 'Metropolitan Manila',
  'Metro Manila 3rd': 'Metropolitan Manila',
  'Metro Manila 4th': 'Metropolitan Manila',
  'Bacolod City': 'Negros Occidental',
  'Davao City 1st': 'Davao del Sur',
  'Davao City 2nd': 'Davao del Sur',
  'Cebu City': 'Cebu',
  'Zamboanga City 1st': 'Zamboanga del Sur',
  'Zamboanga City 2nd': 'Zamboanga del Sur',
  'Cagayan de Oro City': 'Misamis Oriental',
  'General Santos City': 'South Cotabato',
  'Iloilo City': 'Iloilo',
};

/** DEO suffix patterns to strip, ordered from most specific to least */
const DEO_SUFFIXES = [
  / City DEO$/i,
  / \d+(?:st|nd|rd|th) DEO$/i,
  / DEO$/i,
];

/**
 * Strip DEO suffix from a DPWH province name.
 * e.g., "Pampanga 1st DEO" → "Pampanga"
 * e.g., "Tacloban City DEO" → "Tacloban City"
 */
export function stripDeoSuffix(deoName: string): string {
  let result = deoName.trim();
  for (const pattern of DEO_SUFFIXES) {
    if (pattern.test(result)) {
      result = result.replace(pattern, '').trim();
      break;
    }
  }
  return result;
}

/**
 * Normalize a DPWH province name to match PSA PSGC province names.
 * Returns the normalized name, or null if it cannot be mapped.
 */
export function normalizeProvinceName(deoName: string): string | null {
  const stripped = stripDeoSuffix(deoName);

  // Check fallback map first (for known edge cases like city DEOs)
  if (FALLBACK_MAP[stripped]) {
    return FALLBACK_MAP[stripped];
  }

  // Return the stripped name — caller should do case-insensitive lookup
  return stripped;
}

/**
 * Build a lookup function that maps DEO names to province IDs.
 * Call this once at sync time with all provinces from the DB.
 */
export function buildProvinceLookup(
  provinces: Array<{ id: string; name: string; regionId: string }>,
  regions: Array<{ id: string; name: string }>
): (deoName: string, regionName: string) => string | null {
  // Build a case-insensitive name → province map
  const byName = new Map<string, string>();
  for (const p of provinces) {
    byName.set(p.name.toLowerCase(), p.id);
  }

  // Build region name → id map
  const regionByName = new Map<string, string>();
  for (const r of regions) {
    regionByName.set(r.name.toLowerCase(), r.id);
  }

  return (deoName: string, regionName: string): string | null => {
    const normalized = normalizeProvinceName(deoName);
    if (!normalized) return null;

    // Direct lookup
    const direct = byName.get(normalized.toLowerCase());
    if (direct) return direct;

    // Try partial match — province name contains the normalized name
    for (const [name, id] of byName) {
      if (name.includes(normalized.toLowerCase()) || normalized.toLowerCase().includes(name)) {
        return id;
      }
    }

    // If the province field matches a region name, it's a region-level project.
    // Find any province in that region.
    const regionId = regionByName.get(deoName.toLowerCase()) || regionByName.get(regionName.toLowerCase());
    if (regionId) {
      const provinceInRegion = provinces.find(p => p.regionId === regionId);
      if (provinceInRegion) return provinceInRegion.id;
    }

    return null;
  };
}
