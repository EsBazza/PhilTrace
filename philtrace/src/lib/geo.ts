/**
 * Geolocation and distance calculation utilities for MapaTunAI.
 */

export const MAX_REVIEW_RADIUS_KM = 15;

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 *
 * @param lat1 User Latitude in degrees
 * @param lon1 User Longitude in degrees
 * @param lat2 Project Latitude in degrees
 * @param lon2 Project Longitude in degrees
 * @returns Distance in kilometers (km)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const numLat1 = Number(lat1);
  const numLon1 = Number(lon1);
  const numLat2 = Number(lat2);
  const numLon2 = Number(lon2);

  if (
    isNaN(numLat1) ||
    isNaN(numLon1) ||
    isNaN(numLat2) ||
    isNaN(numLon2)
  ) {
    return Infinity;
  }

  const R = 6371; // Earth's mean radius in km
  const dLat = ((numLat2 - numLat1) * Math.PI) / 180;
  const dLon = ((numLon2 - numLon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((numLat1 * Math.PI) / 180) *
      Math.cos((numLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - a)));
  return R * c;
}

/**
 * Returns true if the user's coordinates are within the maximum allowed rating radius (15km).
 */
export function isWithinReviewRadius(
  userLat: number,
  userLng: number,
  projectLat: number,
  projectLng: number,
  maxRadiusKm = MAX_REVIEW_RADIUS_KM
): { isWithin: boolean; distanceKm: number } {
  const distanceKm = calculateHaversineDistance(userLat, userLng, projectLat, projectLng);
  return {
    isWithin: distanceKm <= maxRadiusKm,
    distanceKm: Math.round(distanceKm * 10) / 10,
  };
}
