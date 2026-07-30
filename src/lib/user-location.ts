import type { Company } from '@/types';
import { DEFAULT_MAP_CITY, normalizeCity } from '@/lib/company';

export type LatLng = { lat: number; lng: number };
export type LocationSource = 'gps' | 'fortaleza';

/** Centro de Fortaleza — padrão quando o usuário não permite GPS. */
export const FORTALEZA_CENTER: LatLng = { lat: -3.7327, lng: -38.527 };

const STORAGE_KEY = 'VISITAS_USER_LOCATION';

type StoredLocation = {
  lat: number;
  lng: number;
  source: LocationSource;
  savedAt: string;
};

let cachedUserLocation: LatLng | null = FORTALEZA_CENTER;
let cachedLocationSource: LocationSource = 'fortaleza';

/** Lê a última localização escolhida (GPS ou Fortaleza). */
export function readStoredUserLocation(): {
  position: LatLng;
  source: LocationSource;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLocation>;
    if (
      typeof parsed.lat !== 'number' ||
      !Number.isFinite(parsed.lat) ||
      typeof parsed.lng !== 'number' ||
      !Number.isFinite(parsed.lng)
    ) {
      return null;
    }
    const source: LocationSource =
      parsed.source === 'gps' || parsed.source === 'fortaleza'
        ? parsed.source
        : 'fortaleza';
    return {
      position: { lat: parsed.lat, lng: parsed.lng },
      source,
    };
  } catch {
    return null;
  }
}

function writeStoredUserLocation(pos: LatLng, source: LocationSource): void {
  try {
    const payload: StoredLocation = {
      lat: pos.lat,
      lng: pos.lng,
      source,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function setCachedUserLocation(
  pos: LatLng | null,
  source: LocationSource = 'gps'
): void {
  const next = pos ?? FORTALEZA_CENTER;
  const nextSource = pos ? source : 'fortaleza';
  cachedUserLocation = next;
  cachedLocationSource = nextSource;
  writeStoredUserLocation(next, nextSource);
}

export function getCachedUserLocation(): LatLng {
  return cachedUserLocation ?? FORTALEZA_CENTER;
}

export function getCachedLocationSource(): LocationSource {
  return cachedLocationSource;
}

export function clearCachedUserLocation(): void {
  cachedUserLocation = FORTALEZA_CENTER;
  cachedLocationSource = 'fortaleza';
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function companyDistanceKm(company: Company, from: LatLng): number {
  return haversineKm(from, { lat: company.lat, lng: company.lng });
}

/** Cidade com a empresa mais próxima do ponto. */
export function pickNearestCity(companies: Company[], from: LatLng): string | null {
  let bestCity: string | null = null;
  let bestKm = Infinity;

  for (const company of companies) {
    const city = (company.city || '').trim();
    if (!city) continue;
    const km = companyDistanceKm(company, from);
    if (km < bestKm) {
      bestKm = km;
      bestCity = city;
    }
  }

  return bestCity;
}

export function resolveMapCityForLocation(
  companies: Company[],
  from: LatLng,
  source: LocationSource
): string {
  if (source === 'fortaleza') return DEFAULT_MAP_CITY;
  return pickNearestCity(companies, from) || DEFAULT_MAP_CITY;
}

export function sortCompaniesByDistance(
  companies: Company[],
  from: LatLng
): Array<Company & { distanceKm: number }> {
  return [...companies]
    .map((company) => ({
      ...company,
      distanceKm: companyDistanceKm(company, from),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function citiesNearUser(
  cities: string[],
  companies: Company[],
  from: LatLng
): Array<{ city: string; nearestKm: number }> {
  return cities
    .map((city) => {
      const key = normalizeCity(city);
      const inCity = companies.filter((c) => normalizeCity(c.city || '') === key);
      let nearestKm = Infinity;
      for (const c of inCity) {
        nearestKm = Math.min(nearestKm, companyDistanceKm(c, from));
      }
      return { city, nearestKm };
    })
    .filter((row) => Number.isFinite(row.nearestKm))
    .sort((a, b) => a.nearestKm - b.nearestKm);
}
