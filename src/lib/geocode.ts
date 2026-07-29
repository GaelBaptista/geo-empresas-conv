import { FORTALEZA_NEIGHBORHOODS } from '@/data/fortalezaData';

/**
 * V4: geocode nacional (cidade/UF/CEP/rua).
 * V3 rejeitava tudo fora do Ceará e jogava empresas (ex.: Salvador) em Fortaleza.
 */
const GEOCODE_CACHE_KEY = 'FORTALEZA_GEOCODE_CACHE_V4';

type Coords = { lat: number; lng: number };

export type GeocodeInput = {
  id: string | number;
  cep?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  number?: string | null;
  city?: string | null;
  state?: string | null;
};

let lastStreetGeocodeAt = 0;

function loadCache(): Record<string, Coords | string> {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, Coords | string>;
  } catch {
    /* ignore */
  }
  return {};
}

function saveCache(cache: Record<string, Coords | string>) {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function asCoords(value: Coords | string | undefined): Coords | undefined {
  if (!value || typeof value === 'string') return undefined;
  if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return undefined;
  return value;
}

function normalizeCep(cep: string | null | undefined): string | null {
  if (!cep) return null;
  const digits = cep.replace(/\D/g, '');
  return digits.length === 8 ? digits : null;
}

function normalizeUf(state?: string | null): string | null {
  if (!state) return null;
  const raw = stripAccents(state).trim().toUpperCase();
  if (raw.length === 2) return raw;
  const names: Record<string, string> = {
    ACRE: 'AC',
    ALAGOAS: 'AL',
    AMAPA: 'AP',
    AMAZONAS: 'AM',
    BAHIA: 'BA',
    CEARA: 'CE',
    'DISTRITO FEDERAL': 'DF',
    'ESPIRITO SANTO': 'ES',
    GOIAS: 'GO',
    MARANHAO: 'MA',
    'MATO GROSSO': 'MT',
    'MATO GROSSO DO SUL': 'MS',
    'MINAS GERAIS': 'MG',
    PARA: 'PA',
    PARAIBA: 'PB',
    PARANA: 'PR',
    PERNAMBUCO: 'PE',
    PIAUI: 'PI',
    'RIO DE JANEIRO': 'RJ',
    'RIO GRANDE DO NORTE': 'RN',
    'RIO GRANDE DO SUL': 'RS',
    RONDONIA: 'RO',
    RORAIMA: 'RR',
    'SANTA CATARINA': 'SC',
    'SAO PAULO': 'SP',
    SERGIPE: 'SE',
    TOCANTINS: 'TO',
  };
  return names[raw] || null;
}

function slugifyNeighborhood(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Bounding boxes aproximados por UF — evita aceitar Salvador como Fortaleza. */
const STATE_BBOX: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> =
  {
    AC: { minLat: -11.2, maxLat: -7.1, minLng: -73.99, maxLng: -66.6 },
    AL: { minLat: -10.5, maxLat: -8.8, minLng: -38.3, maxLng: -35.1 },
    AP: { minLat: -1.3, maxLat: 4.5, minLng: -54.9, maxLng: -49.8 },
    AM: { minLat: -9.9, maxLat: 2.3, minLng: -73.9, maxLng: -56.0 },
    BA: { minLat: -18.4, maxLat: -8.5, minLng: -46.7, maxLng: -37.2 },
    CE: { minLat: -7.9, maxLat: -2.7, minLng: -41.5, maxLng: -37.2 },
    DF: { minLat: -16.1, maxLat: -15.4, minLng: -48.3, maxLng: -47.3 },
    ES: { minLat: -21.3, maxLat: -17.9, minLng: -41.9, maxLng: -39.5 },
    GO: { minLat: -19.5, maxLat: -12.4, minLng: -53.3, maxLng: -45.9 },
    MA: { minLat: -10.3, maxLat: -1.0, minLng: -48.8, maxLng: -41.7 },
    MT: { minLat: -18.1, maxLat: -7.3, minLng: -61.7, maxLng: -50.2 },
    MS: { minLat: -24.1, maxLat: -17.1, minLng: -58.2, maxLng: -50.9 },
    MG: { minLat: -22.9, maxLat: -14.2, minLng: -51.1, maxLng: -39.8 },
    PA: { minLat: -9.9, maxLat: 2.6, minLng: -58.9, maxLng: -46.0 },
    PB: { minLat: -8.3, maxLat: -6.0, minLng: -38.9, maxLng: -34.7 },
    PR: { minLat: -26.8, maxLat: -22.5, minLng: -54.7, maxLng: -48.0 },
    PE: { minLat: -9.6, maxLat: -7.2, minLng: -41.4, maxLng: -34.8 },
    PI: { minLat: -10.9, maxLat: -2.7, minLng: -45.9, maxLng: -40.3 },
    RJ: { minLat: -23.4, maxLat: -20.7, minLng: -44.9, maxLng: -40.9 },
    RN: { minLat: -6.99, maxLat: -4.8, minLng: -38.6, maxLng: -34.9 },
    RS: { minLat: -33.8, maxLat: -27.0, minLng: -57.7, maxLng: -49.6 },
    RO: { minLat: -13.7, maxLat: -7.9, minLng: -66.9, maxLng: -59.7 },
    RR: { minLat: -1.5, maxLat: 5.3, minLng: -64.9, maxLng: -58.8 },
    SC: { minLat: -29.4, maxLat: -25.9, minLng: -53.9, maxLng: -48.3 },
    SP: { minLat: -25.4, maxLat: -19.7, minLng: -53.2, maxLng: -44.1 },
    SE: { minLat: -11.6, maxLat: -9.5, minLng: -38.3, maxLng: -36.3 },
    TO: { minLat: -13.5, maxLat: -5.1, minLng: -50.8, maxLng: -45.6 },
  };

function isPlausibleBrazilCoords(coords: Coords): boolean {
  return (
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng) &&
    coords.lat >= -34.0 &&
    coords.lat <= 5.5 &&
    coords.lng >= -74.0 &&
    coords.lng <= -28.0
  );
}

function matchesExpectedRegion(
  coords: Coords,
  state?: string | null,
  bias?: Coords | null,
  maxKm = 80
): boolean {
  if (!isPlausibleBrazilCoords(coords)) return false;

  const uf = normalizeUf(state);
  if (uf && STATE_BBOX[uf]) {
    const box = STATE_BBOX[uf];
    if (
      coords.lat < box.minLat ||
      coords.lat > box.maxLat ||
      coords.lng < box.minLng ||
      coords.lng > box.maxLng
    ) {
      return false;
    }
  }

  if (bias) {
    const dLat = (coords.lat - bias.lat) * 111;
    const dLng = (coords.lng - bias.lng) * 111 * Math.cos((bias.lat * Math.PI) / 180);
    const km = Math.sqrt(dLat * dLat + dLng * dLng);
    if (km > maxKm) return false;
  }

  return true;
}

function deterministicOffset(id: string | number, base: Coords): Coords {
  const seed = String(id)
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const angle = ((seed % 360) * Math.PI) / 180;
  const radius = 0.0012 + (seed % 7) * 0.0002;
  return {
    lat: base.lat + Math.sin(angle) * radius,
    lng: base.lng + Math.cos(angle) * radius,
  };
}

/** Expande abreviações comuns de logradouro (R → Rua, etc.). */
export function normalizeStreetName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return null;

  s = s
    .replace(/^(R\.?|RUA)\s+/i, 'Rua ')
    .replace(/^(AV\.?|AVE\.?|AVENIDA)\s+/i, 'Avenida ')
    .replace(/^(TV\.?|TRAV\.?|TRAVESSA)\s+/i, 'Travessa ')
    .replace(/^(AL\.?|ALAMEDA)\s+/i, 'Alameda ')
    .replace(/^(ROD\.?|RODOVIA)\s+/i, 'Rodovia ')
    .replace(/^(EST\.?|ESTRADA)\s+/i, 'Estrada ')
    .replace(/^(PC\.?|PCA\.?|PRACA|PRAÇA)\s+/i, 'Praça ');

  return s;
}

function significantStreetTokens(street: string): string[] {
  const withoutType = street
    .replace(/^(Rua|Avenida|Travessa|Alameda|Rodovia|Estrada|Praça)\s+/i, '')
    .trim();

  return stripAccents(withoutType)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !['das', 'dos', 'del', 'dela'].includes(w));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function throttleStreetGeocode(minIntervalMs = 1100) {
  const wait = Math.max(0, minIntervalMs - (Date.now() - lastStreetGeocodeAt));
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastStreetGeocodeAt = Date.now();
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  ms = 12000
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

const KNOWN_CITY_CENTERS: Record<string, Coords> = {
  // Capitais / grandes
  fortaleza: { lat: -3.7327, lng: -38.527 },
  salvador: { lat: -12.9777, lng: -38.5016 },
  'sao paulo': { lat: -23.5505, lng: -46.6333 },
  'rio de janeiro': { lat: -22.9068, lng: -43.1729 },
  recife: { lat: -8.0476, lng: -34.877 },
  brasilia: { lat: -15.7939, lng: -47.8828 },
  'belo horizonte': { lat: -19.9167, lng: -43.9345 },
  // Ceará (RM + interior frequente na base)
  pacajus: { lat: -4.1731846, lng: -38.460945 },
  caucaia: { lat: -3.7361, lng: -38.6531 },
  maracanau: { lat: -3.8769, lng: -38.6259 },
  aquiraz: { lat: -3.9065, lng: -38.3877 },
  eusebio: { lat: -3.891, lng: -38.455 },
  horizonte: { lat: -4.0989, lng: -38.4831 },
  cascavel: { lat: -4.1331, lng: -38.2411 },
  beberibe: { lat: -4.1803, lng: -38.1306 },
  maranguape: { lat: -3.8911, lng: -38.6828 },
  pacatuba: { lat: -3.9842, lng: -38.6203 },
  'sao goncalo do amarante': { lat: -3.6053, lng: -38.9683 },
  aracati: { lat: -4.5616, lng: -37.7697 },
  jaguaruana: { lat: -4.8314, lng: -37.7811 },
  'limoeiro do norte': { lat: -5.1456, lng: -38.0983 },
  russas: { lat: -4.9403, lng: -37.9758 },
  'morada nova': { lat: -5.1067, lng: -38.3725 },
  paracuru: { lat: -3.4103, lng: -39.0306 },
  paraipaba: { lat: -3.4392, lng: -39.1478 },
  trairi: { lat: -3.2778, lng: -39.2689 },
  itarema: { lat: -2.9203, lng: -39.9161 },
  camocim: { lat: -2.9022, lng: -40.8411 },
  sobral: { lat: -3.6892, lng: -40.3481 },
  tiangua: { lat: -3.7322, lng: -40.9917 },
  'juazeiro do norte': { lat: -7.2131, lng: -39.3153 },
  crato: { lat: -7.2342, lng: -39.4094 },
  iguatu: { lat: -6.3594, lng: -39.2986 },
  quixada: { lat: -4.9714, lng: -39.0153 },
  caninde: { lat: -4.3589, lng: -39.3114 },
  quixeramobim: { lat: -5.1992, lng: -39.2928 },
  batubara: { lat: -4.3289, lng: -38.8814 },
  'baturite': { lat: -4.3289, lng: -38.8814 },
  redencao: { lat: -4.2258, lng: -38.7306 },
  aiuaba: { lat: -6.5711, lng: -40.1239 },
  taua: { lat: -6.0031, lng: -40.2928 },
  crateus: { lat: -5.1783, lng: -40.6697 },
};

const STATE_CAPITALS: Record<string, Coords> = {
  AC: { lat: -9.97499, lng: -67.8243 },
  AL: { lat: -9.6658, lng: -35.735 },
  AP: { lat: 0.0349, lng: -51.0694 },
  AM: { lat: -3.119, lng: -60.0217 },
  BA: { lat: -12.9777, lng: -38.5016 },
  CE: { lat: -3.7327, lng: -38.527 },
  DF: { lat: -15.7939, lng: -47.8828 },
  ES: { lat: -20.3155, lng: -40.3128 },
  GO: { lat: -16.6869, lng: -49.2648 },
  MA: { lat: -2.5307, lng: -44.3068 },
  MT: { lat: -15.601, lng: -56.0979 },
  MS: { lat: -20.4697, lng: -54.6201 },
  MG: { lat: -19.9167, lng: -43.9345 },
  PA: { lat: -1.4558, lng: -48.4902 },
  PB: { lat: -7.1195, lng: -34.845 },
  PR: { lat: -25.4284, lng: -49.2733 },
  PE: { lat: -8.0476, lng: -34.877 },
  PI: { lat: -5.0892, lng: -42.8016 },
  RJ: { lat: -22.9068, lng: -43.1729 },
  RN: { lat: -5.7945, lng: -35.211 },
  RS: { lat: -30.0346, lng: -51.2177 },
  RO: { lat: -8.7612, lng: -63.9039 },
  RR: { lat: 2.8235, lng: -60.6758 },
  SC: { lat: -27.5954, lng: -48.548 },
  SP: { lat: -23.5505, lng: -46.6333 },
  SE: { lat: -10.9472, lng: -37.0731 },
  TO: { lat: -10.2491, lng: -48.3243 },
};

function cityKey(city?: string | null, state?: string | null): string {
  const c = stripAccents((city || '').trim().toLowerCase());
  const uf = normalizeUf(state);
  return uf ? `${c}|${uf}` : c;
}

/** Centro da cidade sem rede (evita flood no Nominatim). */
function resolveCityCenter(city?: string | null, state?: string | null): Coords | null {
  const name = (city || '').trim();
  if (!name || /^sem cidade/i.test(name) || /^cidade \(/i.test(name)) {
    const uf = normalizeUf(state);
    return uf ? STATE_CAPITALS[uf] || null : null;
  }

  const key = stripAccents(name).toLowerCase();
  const known = KNOWN_CITY_CENTERS[key];
  if (known && matchesExpectedRegion(known, state)) return known;

  const uf = normalizeUf(state);
  if (uf && STATE_CAPITALS[uf]) return STATE_CAPITALS[uf];
  return null;
}

const cepInflight = new Map<string, Promise<Coords | null>>();

async function geocodeByCep(
  cep: string,
  state?: string | null
): Promise<Coords | null> {
  const existing = cepInflight.get(cep);
  if (existing) return existing;

  const job = (async (): Promise<Coords | null> => {
    try {
      const res = await fetchWithTimeout(
        `https://cep.awesomeapi.com.br/json/${cep}`,
        undefined,
        3500
      );
      if (res?.ok) {
        const data = (await res.json()) as {
          lat?: string;
          lng?: string;
          status?: number;
          state?: string;
        };
        if (data.lat && data.lng && !data.status) {
          const coords = { lat: Number(data.lat), lng: Number(data.lng) };
          const uf = normalizeUf(state) || normalizeUf(data.state);
          if (matchesExpectedRegion(coords, uf)) return coords;
        }
      }
    } catch {
      /* tenta BrasilAPI */
    }

    try {
      const res = await fetchWithTimeout(
        `https://brasilapi.com.br/api/cep/v2/${cep}`,
        undefined,
        4000
      );
      if (!res?.ok) return null;
      const data = (await res.json()) as {
        state?: string;
        location?: { coordinates?: { latitude?: number; longitude?: number } };
      };
      const lat = data.location?.coordinates?.latitude;
      const lng = data.location?.coordinates?.longitude;
      if (lat == null || lng == null) return null;
      const coords = { lat: Number(lat), lng: Number(lng) };
      const uf = normalizeUf(state) || normalizeUf(data.state);
      return matchesExpectedRegion(coords, uf) ? coords : null;
    } catch {
      return null;
    }
  })();

  cepInflight.set(cep, job);
  try {
    return await job;
  } finally {
    cepInflight.delete(cep);
  }
}

function neighborhoodFallback(
  neighborhoodName: string | null | undefined,
  id: string | number,
  cityCenter: Coords
): Coords {
  const name = (neighborhoodName || '').trim();
  const known = FORTALEZA_NEIGHBORHOODS.find(
    (n) => n.name.toLowerCase() === name.toLowerCase() || n.id === slugifyNeighborhood(name)
  );

  // Só usa bairro de Fortaleza se o centro da cidade for perto de Fortaleza
  if (known?.center) {
    const fortaleza = KNOWN_CITY_CENTERS.fortaleza;
    const nearFortaleza =
      Math.abs(cityCenter.lat - fortaleza.lat) < 0.35 &&
      Math.abs(cityCenter.lng - fortaleza.lng) < 0.35;
    if (nearFortaleza) {
      return deterministicOffset(id, { lat: known.center[0], lng: known.center[1] });
    }
  }

  return deterministicOffset(id, cityCenter);
}

type OverpassWay = {
  type: string;
  center?: { lat: number; lon: number };
  nodes?: number[];
  tags?: { name?: string; highway?: string };
};

function scoreStreetMatch(way: OverpassWay, tokens: string[]): number {
  const name = stripAccents(way.tags?.name || '').toLowerCase();
  if (!name) return -1;

  let score = 0;
  let matched = 0;
  for (const token of tokens) {
    if (name.includes(token)) {
      matched += 1;
      score += token.length;
    }
  }
  if (matched < Math.min(2, tokens.length)) return -1;

  const highway = way.tags?.highway || '';
  if (['primary', 'secondary', 'tertiary', 'trunk'].includes(highway)) score += 30;
  else if (highway === 'residential') score += 10;

  score += Math.min(40, (way.nodes?.length || 0) / 2);
  return score;
}

function offsetByHouseNumber(base: Coords, number?: string | null): Coords {
  const digits = (number || '').replace(/\D/g, '');
  if (!digits) return base;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return base;

  const t = ((n % 2500) / 2500) * 2 - 1;
  return {
    lat: base.lat + t * 0.0008,
    lng: base.lng + t * 0.0035,
  };
}

async function geocodeStreetWithOverpass(input: {
  street: string;
  bias: Coords;
  state?: string | null;
}): Promise<Coords | null> {
  const tokens = significantStreetTokens(input.street);
  if (tokens.length === 0) return null;

  const searchPart = tokens.slice(-2).map(escapeRegex).join('.*');
  const query = `[out:json][timeout:20];
(
  way["highway"]["name"~"${searchPart}",i](around:18000,${input.bias.lat},${input.bias.lng});
);
out center;`;

  await throttleStreetGeocode(1500);
  const res = await fetchWithTimeout(
    'https://overpass-api.de/api/interpreter',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `data=${encodeURIComponent(query)}`,
    },
    22000
  );
  if (!res?.ok) return null;

  const data = (await res.json()) as { elements?: OverpassWay[] };
  const elements = data.elements || [];
  if (elements.length === 0) return null;

  let best: OverpassWay | null = null;
  let bestScore = -1;
  for (const el of elements) {
    if (!el.center) continue;
    const coords = { lat: el.center.lat, lng: el.center.lon };
    if (!matchesExpectedRegion(coords, input.state, input.bias, 40)) continue;
    const score = scoreStreetMatch(el, tokens);
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (!best?.center || bestScore < 0) return null;
  return { lat: best.center.lat, lng: best.center.lon };
}

/**
 * Caminho rápido: cache → CEP → centro da cidade (local) → bairro.
 * Sem Nominatim na carga (evita 429).
 */
export async function resolveCoordinatesFast(input: GeocodeInput): Promise<Coords> {
  const cache = loadCache();
  const cacheKey = `id:${input.id}`;
  const sourceKey = `source:${input.id}`;
  const uf = normalizeUf(input.state);

  const cityCenter = resolveCityCenter(input.city, input.state);

  const cached = asCoords(cache[cacheKey]);
  if (cached) {
    const ok = matchesExpectedRegion(cached, uf, cityCenter, 100);
    if (ok) return cached;
  }

  const street = normalizeStreetName(input.address);
  if (street) {
    const streetKey = `street:${stripAccents(street).toLowerCase()}|${cityKey(input.city, input.state)}`;
    const streetCached = asCoords(cache[streetKey]);
    if (streetCached && matchesExpectedRegion(streetCached, uf, cityCenter, 60)) {
      cache[cacheKey] = streetCached;
      cache[sourceKey] = 'street';
      saveCache(cache);
      return streetCached;
    }
  }

  const cep = normalizeCep(input.cep);
  if (cep) {
    const cepKey = `cep:${cep}`;
    let cepCoords = asCoords(cache[cepKey]);
    if (!cepCoords || !matchesExpectedRegion(cepCoords, uf, cityCenter, 120)) {
      const fetched = await geocodeByCep(cep, input.state);
      if (fetched) {
        cepCoords = fetched;
        cache[cepKey] = fetched;
      } else {
        cepCoords = undefined;
      }
    }

    if (cepCoords && matchesExpectedRegion(cepCoords, uf, cityCenter, 120)) {
      const coords = deterministicOffset(input.id, cepCoords);
      cache[cacheKey] = coords;
      cache[sourceKey] = 'cep';
      saveCache(cache);
      return coords;
    }
  }

  if (cityCenter) {
    const fallback = neighborhoodFallback(input.neighborhood, input.id, cityCenter);
    cache[cacheKey] = fallback;
    cache[sourceKey] = 'city';
    saveCache(cache);
    return fallback;
  }

  const lastResort =
    uf === 'CE' || !input.city
      ? KNOWN_CITY_CENTERS.fortaleza
      : STATE_CAPITALS[uf || ''] || { lat: -14.235, lng: -51.9253 };
  const coords = deterministicOffset(input.id, lastResort);
  cache[cacheKey] = coords;
  cache[sourceKey] = 'fallback';
  saveCache(cache);
  return coords;
}

/**
 * Refine de rua via Overpass desligado (serviço público falha em massa e polui a rede).
 * Pins usam CEP/centro; navegação no Google Maps usa o endereço textual da API.
 */
export async function refineStreetCoordinates(_input: GeocodeInput): Promise<Coords | null> {
  return null;
}

export async function resolveCoordinates(input: GeocodeInput): Promise<Coords> {
  return resolveCoordinatesFast(input);
}

export function neighborhoodIdFromName(
  name: string | null | undefined,
  city?: string | null
): string {
  const raw = (name || 'bairro').trim() || 'bairro';
  const citySlug = slugifyNeighborhood(city || 'sem_cidade') || 'sem_cidade';
  const known = FORTALEZA_NEIGHBORHOODS.find(
    (n) =>
      n.name.toLowerCase() === raw.toLowerCase() &&
      (!city || n.city.toLowerCase() === city.trim().toLowerCase())
  );
  if (known) return known.id;
  return `${citySlug}_${slugifyNeighborhood(raw)}`;
}

/** Invalida caches antigos que colocavam outras UFs em Fortaleza. */
export function clearLegacyGeocodeCaches() {
  try {
    localStorage.removeItem('FORTALEZA_GEOCODE_CACHE_V2');
    localStorage.removeItem('FORTALEZA_GEOCODE_CACHE_V3');
  } catch {
    /* ignore */
  }
}

export { slugifyNeighborhood };
