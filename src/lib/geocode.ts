import { fortalezaBairroIndex, type BairroCenter } from '@/data/fortaleza-bairro-coords';
import { FORTALEZA_NEIGHBORHOODS } from '@/data/fortalezaData';

/**
 * V9: match de bairro tolerante a grafias (Vila Pery → Vila Peri).
 * V8: em Fortaleza o BAIRRO manda; CEP só vale se bater com o bairro.
 * V7: CEPs errados (ou 429/cache) jogavam pins na Barra do Ceará em vez de Vila Peri etc.
 */
const GEOCODE_CACHE_KEY = 'FORTALEZA_GEOCODE_CACHE_V9';

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

/** Cache em memória — evita JSON.parse/stringify a cada pin. */
let memoryCache: Record<string, Coords | string> | null = null;
let cacheDirty = false;
let saveCacheTimer: number | null = null;

function loadCache(): Record<string, Coords | string> {
  if (memoryCache) return memoryCache;
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    memoryCache = raw ? (JSON.parse(raw) as Record<string, Coords | string>) : {};
  } catch {
    memoryCache = {};
  }
  return memoryCache;
}

function flushCacheToStorage() {
  if (!cacheDirty || !memoryCache) return;
  cacheDirty = false;
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(memoryCache));
  } catch {
    /* ignore quota */
  }
}

function saveCache(_cache?: Record<string, Coords | string>, immediate = false) {
  if (_cache) memoryCache = _cache;
  if (!memoryCache) return;
  cacheDirty = true;
  if (immediate) {
    if (saveCacheTimer != null) {
      window.clearTimeout(saveCacheTimer);
      saveCacheTimer = null;
    }
    flushCacheToStorage();
    return;
  }
  if (typeof window === 'undefined') {
    flushCacheToStorage();
    return;
  }
  if (saveCacheTimer != null) return;
  saveCacheTimer = window.setTimeout(() => {
    saveCacheTimer = null;
    flushCacheToStorage();
  }, 900);
}

/** Força persistir o cache (chamar ao fim do load de empresas). */
export function flushGeocodeCache() {
  if (saveCacheTimer != null) {
    window.clearTimeout(saveCacheTimer);
    saveCacheTimer = null;
  }
  flushCacheToStorage();
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
  return scatterInArea(base, String(id), 0.0018);
}

/**
 * Espalha pontos no entorno de `base` de forma determinística (mesmo seed → mesmo lugar).
 * radiusDeg ~0.002 ≈ 220m; 0.006 ≈ 650m.
 */
function scatterInArea(base: Coords, seed: string, radiusDeg = 0.0035): Coords {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Ângulo áureo + raio em anéis (evita colapso no centro e amontoado)
  const u = (h >>> 0) / 0xffffffff;
  const v = ((h * 2654435761) >>> 0) / 0xffffffff;
  const angle = u * Math.PI * 2;
  const ring = 0.22 + v * 0.78; // evita o miolo exato
  const r = radiusDeg * ring;
  return {
    lat: base.lat + Math.sin(angle) * r,
    lng: base.lng + Math.cos(angle) * r * 1.15, // lng um pouco mais aberto perto do equador
  };
}

function locationSeed(input: GeocodeInput): string {
  return [
    input.id,
    input.cep || '',
    input.address || '',
    input.number || '',
    input.neighborhood || '',
    input.city || '',
  ]
    .join('|')
    .toLowerCase();
}

const BAIRRO_INDEX = fortalezaBairroIndex();

/**
 * Normaliza grafias comuns de bairros BR (y↔i, ss↔s, etc.) para matching.
 * Ex.: vila_pery → vila_peri (senão o hash cairia em Jardim Iracema!).
 */
function foldBairroSlug(slug: string): string {
  return slug
    .replace(/y/g, 'i')
    .replace(/ss/g, 's')
    .replace(/rr/g, 'r')
    .replace(/ll/g, 'l')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't');
}

/** Distância de edição leve (até maxDist) — bairros com 1–2 letras de diferença. */
function slugEditDistance(a: string, b: string, maxDist = 2): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const prev = new Array<number>(cols);
  const cur = new Array<number>(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;
  for (let i = 1; i < rows; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let j = 0; j < cols; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/** Match de bairro de Fortaleza (catálogo amplo + lista UI). */
function findFortalezaNeighborhood(
  neighborhoodName: string | null | undefined
): BairroCenter | null {
  const name = (neighborhoodName || '').trim();
  if (!name) return null;
  // "Outros / sem bairro" não é bairro real
  if (/^outros/i.test(name) || /sem bairro/i.test(name)) return null;

  const slug = slugifyNeighborhood(name);
  if (!slug || slug.length < 3) return null;

  const exact = BAIRRO_INDEX.get(slug);
  if (exact) return exact;

  // Tenta sem prefixos comuns
  const stripped = slug
    .replace(/^(bairro|conjunto|conj|cj|loteamento|lot)_/, '')
    .replace(/_ceara$|_fortaleza$/, '');
  if (stripped && BAIRRO_INDEX.get(stripped)) return BAIRRO_INDEX.get(stripped)!;

  // Grafia fonética: Vila Pery → Vila Peri, Álvaro Waine → Weyne, etc.
  const folded = foldBairroSlug(slug);
  const foldedStripped = foldBairroSlug(stripped || slug);
  if (folded !== slug) {
    for (const [ns, b] of BAIRRO_INDEX) {
      if (foldBairroSlug(ns) === folded) return b;
    }
  }
  if (foldedStripped && foldedStripped !== folded) {
    for (const [ns, b] of BAIRRO_INDEX) {
      if (foldBairroSlug(ns) === foldedStripped) return b;
    }
  }

  // Parcial: maior slug de bairro contido no nome (evita “Centro” engolir tudo)
  let best: BairroCenter | null = null;
  let bestLen = 0;
  for (const [ns, b] of BAIRRO_INDEX) {
    if (ns.length < 5) continue; // não matchar "coco" em qualquer coisa curta
    const nsFold = foldBairroSlug(ns);
    if (
      slug === ns ||
      slug.includes(ns) ||
      ns.includes(slug) ||
      folded.includes(nsFold) ||
      nsFold.includes(folded)
    ) {
      if (ns.length > bestLen) {
        best = b;
        bestLen = ns.length;
      }
    }
  }
  if (best) return best;

  // Fuzzy: 1 letra de diferença em nomes longos (Pery/Peri já coberto pelo fold;
  // cobre typos tipo "Parangaba"/"Parangabaa")
  const fuzzyTarget = foldedStripped || folded;
  if (fuzzyTarget.length >= 6) {
    let fuzzyBest: BairroCenter | null = null;
    let fuzzyDist = 3;
    for (const [ns, b] of BAIRRO_INDEX) {
      if (ns.length < 5) continue;
      const d = slugEditDistance(fuzzyTarget, foldBairroSlug(ns), 2);
      if (d < fuzzyDist && d <= (fuzzyTarget.length >= 10 ? 2 : 1)) {
        fuzzyDist = d;
        fuzzyBest = b;
      }
    }
    if (fuzzyBest) return fuzzyBest;
  }

  // "Centro" só se o nome for essencialmente Centro
  if (slug === 'centro' || slug === 'centro_da_cidade') {
    return BAIRRO_INDEX.get('centro') || null;
  }
  return null;
}

/** Extrai bairro de strings tipo "Rua X, 10 - Novo Siqueira, Fortaleza - CE". */
export function extractNeighborhoodFromText(
  ...parts: Array<string | null | undefined>
): string | null {
  const raw = parts.filter(Boolean).join(' | ');
  if (!raw.trim()) return null;

  // Padrões comuns de endereço brasileiro
  const patterns = [
    /[-–]\s*([A-Za-zÀ-ÿ0-9' ]{3,40}?)\s*,\s*Fortaleza/i,
    /,\s*([A-Za-zÀ-ÿ0-9' ]{3,40}?)\s*[-–]\s*Fortaleza/i,
    /bairro[:\s]+([A-Za-zÀ-ÿ0-9' ]{3,40})/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) {
      const candidate = m[1].trim().replace(/\s+/g, ' ');
      if (findFortalezaNeighborhood(candidate)) return candidate;
      if (candidate.length >= 4 && !/^(rua|av|avenida|n[ºo°]?|cep)/i.test(candidate)) {
        return candidate;
      }
    }
  }

  // Último recurso: achar nome de bairro conhecido dentro do texto
  const lower = stripAccents(raw).toLowerCase();
  const lowerFolded = foldBairroSlug(slugifyNeighborhood(lower) || lower);
  let best: BairroCenter | null = null;
  let bestLen = 0;
  for (const [slug, b] of BAIRRO_INDEX) {
    if (slug.length < 5) continue;
    const label = stripAccents(b.name).toLowerCase();
    const labelFolded = foldBairroSlug(slug);
    if (
      (lower.includes(label) || (labelFolded.length >= 5 && lowerFolded.includes(labelFolded))) &&
      label.length > bestLen
    ) {
      best = b;
      bestLen = label.length;
    }
  }
  return best?.name || null;
}

/**
 * Posição estável por nome de bairro desconhecido, dentro do polígono de Fortaleza
 * (longe do Centro histórico quando o slug não é Centro).
 */
function gridPlaceInFortaleza(seed: string): Coords {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Bounding box urbano aproximado de Fortaleza (evita mar e interior distante)
  const minLat = -3.88;
  const maxLat = -3.71;
  const minLng = -38.62;
  const maxLng = -38.44;
  const u = (h >>> 0) / 0xffffffff;
  const v = ((h * 2654435761) >>> 0) / 0xffffffff;
  return {
    lat: minLat + u * (maxLat - minLat),
    lng: minLng + v * (maxLng - minLng),
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

/** Limite global de CEPs em paralelo (evita flood da AwesomeAPI/BrasilAPI). */
let cepActive = 0;
const cepWaitQueue: Array<() => void> = [];

async function withCepSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (cepActive >= 6) {
    await new Promise<void>((resolve) => cepWaitQueue.push(resolve));
  }
  cepActive += 1;
  try {
    return await fn();
  } finally {
    cepActive -= 1;
    const next = cepWaitQueue.shift();
    if (next) next();
  }
}

type CepGeoResult = {
  coords: Coords | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

const cepInflightMeta = new Map<string, Promise<CepGeoResult>>();

async function geocodeByCepFull(cep: string, state?: string | null): Promise<CepGeoResult> {
  const existing = cepInflightMeta.get(cep);
  if (existing) return existing;

  const empty: CepGeoResult = {
    coords: null,
    neighborhood: null,
    city: null,
    state: null,
  };

  const job = withCepSlot(async (): Promise<CepGeoResult> => {
    let result: CepGeoResult = { ...empty };

    // 1) BrasilAPI primeiro (bairro confiável; coords quando existem)
    try {
      const res = await fetchWithTimeout(
        `https://brasilapi.com.br/api/cep/v2/${cep}`,
        undefined,
        3500
      );
      if (res?.ok) {
        const data = (await res.json()) as {
          state?: string;
          city?: string;
          neighborhood?: string;
          location?: { coordinates?: { latitude?: number; longitude?: number } };
        };
        const lat = data.location?.coordinates?.latitude;
        const lng = data.location?.coordinates?.longitude;
        let coords: Coords | null = null;
        if (lat != null && lng != null) {
          const c = { lat: Number(lat), lng: Number(lng) };
          const uf = normalizeUf(state) || normalizeUf(data.state);
          if (matchesExpectedRegion(c, uf)) coords = c;
        }
        result = {
          coords,
          neighborhood: data.neighborhood || null,
          city: data.city || null,
          state: data.state || null,
        };
        // Bairro + cidade bastam; coords bônus quando vêm
        if (result.neighborhood) {
          // tenta coords extras só se ainda faltam
          if (result.coords) return result;
        }
      }
    } catch {
      /* continua */
    }

    // 2) ViaCEP — bairro
    if (!result.neighborhood) {
      try {
        const res = await fetchWithTimeout(
          `https://viacep.com.br/ws/${cep}/json/`,
          undefined,
          3000
        );
        if (res?.ok) {
          const data = (await res.json()) as {
            erro?: boolean;
            bairro?: string;
            localidade?: string;
            uf?: string;
          };
          if (!data.erro) {
            result = {
              coords: result.coords,
              neighborhood: data.bairro || null,
              city: data.localidade || result.city,
              state: data.uf || result.state,
            };
          }
        }
      } catch {
        /* continua */
      }
    }

    // 3) AwesomeAPI só se faltar lat/lng (pode rate-limit 429 — ignorável)
    if (!result.coords) {
      try {
        const res = await fetchWithTimeout(
          `https://cep.awesomeapi.com.br/json/${cep}`,
          undefined,
          2500
        );
        if (res?.ok) {
          const data = (await res.json()) as {
            lat?: string;
            lng?: string;
            status?: number;
            state?: string;
            city?: string;
            district?: string;
            neighborhood?: string;
          };
          if (!data.status && data.lat && data.lng) {
            const c = { lat: Number(data.lat), lng: Number(data.lng) };
            const uf = normalizeUf(state) || normalizeUf(data.state);
            if (matchesExpectedRegion(c, uf)) {
              result = {
                coords: c,
                neighborhood: result.neighborhood || data.district || data.neighborhood || null,
                city: result.city || data.city || null,
                state: result.state || data.state || null,
              };
            }
          }
        }
      } catch {
        /* ignore */
      }
    }

    return result.coords || result.neighborhood ? result : empty;
  });

  cepInflightMeta.set(cep, job);
  try {
    return await job;
  } finally {
    cepInflightMeta.delete(cep);
  }
}

async function geocodeByCep(cep: string, state?: string | null): Promise<Coords | null> {
  const result = await geocodeByCepFull(cep, state);
  return result.coords;
}

function isFortalezaCity(city?: string | null): boolean {
  const key = stripAccents((city || '').trim()).toLowerCase();
  return key === 'fortaleza' || key.startsWith('fortaleza ');
}

/**
 * Place por cidade + bairro da API.
 * Fortaleza: catálogo de bairros. Outras cidades (ex.: Maracanaú): centro da cidade + scatter por bairro.
 */
function neighborhoodFallback(
  neighborhoodName: string | null | undefined,
  id: string | number,
  cityCenter: Coords,
  addressSeed?: string,
  cityName?: string | null
): Coords {
  const seed = addressSeed || String(id);
  const name = (neighborhoodName || '').trim();
  const fortaleza = isFortalezaCity(cityName);

  if (fortaleza) {
    const known = findFortalezaNeighborhood(name);
    if (known) {
      const dense = /centro|aldeota|meireles|benfica|f[aá]tima|papicu|iracema/i.test(
        known.name
      );
      return scatterInArea(
        { lat: known.lat, lng: known.lng },
        seed,
        dense ? 0.004 : 0.0032
      );
    }
    if (name && !/^outros/i.test(name) && !/sem bairro/i.test(name)) {
      const base = gridPlaceInFortaleza(slugifyNeighborhood(name) || name);
      return scatterInArea(base, seed, 0.0028);
    }
  }

  // Maracanaú, Caucaia, etc.: sempre no centro da CIDADE + offset do bairro (nunca jogar em Fortaleza)
  if (name && !/^outros/i.test(name) && !/sem bairro/i.test(name)) {
    return scatterInArea(cityCenter, `${seed}|${name}`, 0.012);
  }

  return scatterInArea(cityCenter, seed, 0.006);
}

/**
 * Pré-carrega CEPs únicos da API (AwesomeAPI/BrasilAPI) para o mapa nascer estável.
 * Não atualiza o mapa em lotes depois (evita pins "andando").
 */
export async function preloadCepCoordinates(
  items: Array<{ cep?: string | null; state?: string | null }>,
  options?: { maxMs?: number; concurrency?: number }
): Promise<void> {
  const maxMs = options?.maxMs ?? 18000;
  const concurrency = options?.concurrency ?? 8;
  const cache = loadCache();
  const unique = new Map<string, string | null | undefined>();

  for (const item of items) {
    const cep = normalizeCep(item.cep);
    if (!cep) continue;
    if (asCoords(cache[`cep3:${cep}`])) continue;
    if (cache[`cep3miss:${cep}`] === '1') continue;
    if (!unique.has(cep)) unique.set(cep, item.state);
  }

  const list = [...unique.entries()];
  if (list.length === 0) return;

  const started = Date.now();
  let cursor = 0;

  async function worker() {
    while (cursor < list.length) {
      if (Date.now() - started > maxMs) return;
      const i = cursor++;
      const [cep, state] = list[i];
      try {
        const meta = await geocodeByCepFull(cep, state);
        if (meta.neighborhood) {
          cache[`cep3district:${cep}`] = meta.neighborhood;
        }
        if (meta.coords) {
          // Se o bairro do CEP é conhecido e a coord está longe, descarta lat/lng (CEP "mentiroso")
          const known = findFortalezaNeighborhood(meta.neighborhood);
          if (known && kmBetween(meta.coords, { lat: known.lat, lng: known.lng }) > 2.8) {
            delete cache[`cep3:${cep}`];
            // NÃO marca miss: ainda usamos o district no resolve
          } else {
            cache[`cep3:${cep}`] = meta.coords;
            delete cache[`cep3miss:${cep}`];
          }
        } else if (!meta.neighborhood) {
          cache[`cep3miss:${cep}`] = '1';
        }
      } catch {
        cache[`cep3miss:${cep}`] = '1';
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, list.length) }, () => worker())
  );
  saveCache(cache, true);
}

let lastNominatimAt = 0;

async function throttleNominatim(minIntervalMs = 1100) {
  const wait = Math.max(0, minIntervalMs - (Date.now() - lastNominatimAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();
}

type NominatimHit = {
  lat: string;
  lon: string;
  display_name?: string;
  type?: string;
  class?: string;
};

/** Pontua hit do Nominatim — prioriza rua/prédio e rejeita cidade/bairro genérico. */
function scoreNominatimHit(hit: NominatimHit, streetTokens: string[]): number {
  const cls = (hit.class || '').toLowerCase();
  const typ = (hit.type || '').toLowerCase();
  const display = stripAccents(hit.display_name || '').toLowerCase();

  let score = 0;
  if (cls === 'highway') score += 60;
  else if (cls === 'building' || typ === 'house' || typ === 'residential') score += 45;
  else if (cls === 'place' && (typ === 'house' || typ === 'isolated_dwelling')) score += 40;
  else if (cls === 'amenity' || cls === 'shop' || cls === 'office') score += 25;

  // Genéricos demais (centro da cidade / bairro) — quase sempre descartar
  if (
    typ === 'administrative' ||
    typ === 'city' ||
    typ === 'municipality' ||
    typ === 'state' ||
    typ === 'suburb' ||
    typ === 'neighbourhood' ||
    typ === 'neighborhood' ||
    cls === 'boundary'
  ) {
    score -= 120;
  }

  let matched = 0;
  for (const token of streetTokens) {
    if (display.includes(token)) {
      matched += 1;
      score += Math.min(18, token.length + 4);
    }
  }
  if (streetTokens.length > 0 && matched === 0) score -= 40;
  if (streetTokens.length >= 2 && matched < 2) score -= 15;

  return score;
}

/** Rua via Nominatim (proxy local ou Function Netlify). Sem Overpass no caminho quente. */
async function geocodeByStreetQuery(
  input: GeocodeInput,
  bias: Coords | null
): Promise<Coords | null> {
  const street = normalizeStreetName(input.address);
  const neighborhood = (input.neighborhood || '').trim();
  if (!street) return null;

  const tokens = significantStreetTokens(street);
  if (tokens.length === 0) return null;

  const uf = normalizeUf(input.state) || 'CE';
  const city = (input.city || '').trim() || 'Fortaleza';
  const number = (input.number || '').replace(/\D/g, '');

  const queries: string[] = [];
  // Query mais específica primeiro — costuma acertar e evita 2ª/3ª chamada
  queries.push([street, number, neighborhood, city, uf, 'Brasil'].filter(Boolean).join(', '));
  if (neighborhood) {
    queries.push([street, neighborhood, city, uf, 'Brasil'].filter(Boolean).join(', '));
  } else if (tokens.length >= 2) {
    queries.push([street, city, uf, 'Brasil'].filter(Boolean).join(', '));
  }

  const maxKmFromBias = bias ? 45 : 80;

  for (const q of queries) {
    await throttleNominatim(1100);
    try {
      const endpoints = import.meta.env.PROD
        ? [`/.netlify/functions/geocode-search?q=${encodeURIComponent(q)}`]
        : [
            `/api/nominatim/search?format=json&limit=5&countrycodes=br&addressdetails=1&q=${encodeURIComponent(q)}`,
          ];

      for (const endpoint of endpoints) {
        const res = await fetchWithTimeout(endpoint, undefined, 10000);
        if (!res?.ok) continue;
        const hits = (await res.json()) as NominatimHit[];
        if (!Array.isArray(hits) || hits.length === 0) continue;

        let best: Coords | null = null;
        let bestScore = 0;
        for (const hit of hits) {
          const coords = { lat: Number(hit.lat), lng: Number(hit.lon) };
          if (!matchesExpectedRegion(coords, input.state, bias, maxKmFromBias)) continue;
          const score = scoreNominatimHit(hit, tokens);
          if (score > bestScore) {
            bestScore = score;
            best = coords;
          }
        }
        // Exige score mínimo de rua/logradouro (evita “Fortaleza” genérico)
        if (best && bestScore >= 40) return best;
      }
    } catch {
      /* tenta próxima query */
    }
  }
  return null;
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

function offsetByHouseNumber(base: Coords, number?: string | null, scale = 1): Coords {
  const digits = (number || '').replace(/\D/g, '');
  if (!digits) return base;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return base;

  const t = ((n % 2500) / 2500) * 2 - 1;
  const s = Math.max(0.05, scale);
  return {
    lat: base.lat + t * 0.0008 * s,
    lng: base.lng + t * 0.0035 * s,
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

function pickNeighborhood(input: GeocodeInput): string | null {
  const raw = (input.neighborhood || '').trim();
  if (raw && !/^outros/i.test(raw) && !/sem bairro/i.test(raw)) {
    return raw;
  }
  return extractNeighborhoodFromText(input.address, input.neighborhood);
}

/**
 * Posição final a partir dos campos da API:
 * cep, address, neighborhood, city, state, number
 *
 * Ex.: "R. Antônio Costa Mendes, 105 - Vila Peri, Fortaleza - CE, 60730-175"
 * → pin em Vila Peri (Parangaba), NÃO na Barra do Ceará.
 *
 * Em Fortaleza: bairro conhecido manda; CEP só conta se estiver perto do bairro.
 */
export async function resolveCoordinatesFast(input: GeocodeInput): Promise<Coords> {
  const cache = loadCache();
  const seed = locationSeed(input);
  const cacheKey = `v9:${seed}`;
  const uf = normalizeUf(input.state);
  const cityCenter = resolveCityCenter(input.city, input.state);
  const isFortaleza = isFortalezaCity(input.city);

  // Rua já refinada em visita anterior → usa direto (sem rede)
  const streetCached = asCoords(cache[`street9:${seed}`]);
  if (streetCached && matchesExpectedRegion(streetCached, uf, cityCenter, 120)) {
    if (!asCoords(cache[cacheKey])) {
      cache[cacheKey] = streetCached;
      saveCache(cache);
    }
    return streetCached;
  }

  const cached = asCoords(cache[cacheKey]);
  if (cached && matchesExpectedRegion(cached, uf, cityCenter, 120)) {
    return cached;
  }

  const cep = normalizeCep(input.cep);
  const districtFromCep =
    cep && typeof cache[`cep3district:${cep}`] === 'string'
      ? String(cache[`cep3district:${cep}`])
      : null;

  // neighborhood da API + texto do endereço + bairro do CEP (BrasilAPI)
  const neighborhood =
    pickNeighborhood(input) ||
    (districtFromCep && !/^outros/i.test(districtFromCep) ? districtFromCep : null);

  const knownBairro = isFortaleza ? findFortalezaNeighborhood(neighborhood) : null;
  const cepCoords = cep ? asCoords(cache[`cep3:${cep}`]) : undefined;

  // 1) Fortaleza + bairro conhecido → âncora no BAIRRO (ignora CEP longe / errado)
  if (knownBairro) {
    const bairroCenter = { lat: knownBairro.lat, lng: knownBairro.lng };
    let base = bairroCenter;

    if (
      cepCoords &&
      matchesExpectedRegion(cepCoords, uf, cityCenter, 80) &&
      kmBetween(cepCoords, bairroCenter) <= 2.8
    ) {
      base = cepCoords;
    }

    let coords = offsetByHouseNumber(base, input.number);
    coords = scatterInArea(coords, seed, base === bairroCenter ? 0.0022 : 0.0005);
    cache[cacheKey] = coords;
    saveCache(cache);
    return coords;
  }

  // 2) CEP sozinho (cidade sem catálogo de bairro, ou Fortaleza sem bairro)
  if (cepCoords && matchesExpectedRegion(cepCoords, uf, cityCenter, 150)) {
    let coords = offsetByHouseNumber(cepCoords, input.number);
    coords = scatterInArea(coords, seed, 0.00055);
    cache[cacheKey] = coords;
    saveCache(cache);
    return coords;
  }

  // 3) Cidade + bairro texto
  const local = localCoordsOnly({
    ...input,
    neighborhood,
  });
  cache[cacheKey] = local;
  saveCache(cache);
  return local;
}

function kmBetween(a: Coords, b: Coords): number {
  const dLat = (a.lat - b.lat) * 111;
  const dLng =
    (a.lng - b.lng) * 111 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function localCoordsOnly(input: GeocodeInput): Coords {
  const seed = locationSeed(input);
  const uf = normalizeUf(input.state);
  const cityCenter = resolveCityCenter(input.city, input.state);
  const neighborhood = pickNeighborhood(input);

  if (cityCenter) {
    return neighborhoodFallback(
      neighborhood,
      input.id,
      cityCenter,
      seed,
      input.city
    );
  }

  const lastResort =
    uf === 'CE'
      ? KNOWN_CITY_CENTERS.fortaleza
      : STATE_CAPITALS[uf || ''] || { lat: -14.235, lng: -51.9253 };
  return scatterInArea(lastResort, seed, 0.005);
}

/**
 * @deprecated Prefer preloadCepCoordinates + resolveCoordinatesFast no load.
 * Mantido para compat; NÃO dispara callbacks em lote (só no fim, se onBatch).
 */
export async function enrichCoordinatesWithCep(
  companies: Array<{
    id: string | number;
    lat: number;
    lng: number;
    cep?: string | null;
    number?: string | null;
    streetNumber?: string | null;
    neighborhood?: string | null;
    neighborhoodName?: string | null;
    address?: string | null;
    streetAddress?: string | null;
    city?: string | null;
    state?: string | null;
  }>,
  onProgress?: (done: number, total: number) => void,
  onBatch?: (partial: EnrichCoordResult[]) => void
): Promise<EnrichCoordResult[]> {
  await preloadCepCoordinates(
    companies.map((c) => ({ cep: c.cep, state: c.state })),
    { maxMs: 20000, concurrency: 8 }
  );

  const cache = loadCache();
  const results: EnrichCoordResult[] = [];

  for (const c of companies) {
    const coords = await resolveCoordinatesFast({
      id: c.id,
      cep: c.cep,
      number: c.streetNumber || c.number,
      neighborhood: c.neighborhoodName || c.neighborhood,
      address: c.streetAddress || c.address,
      city: c.city,
      state: c.state,
    });
    const changed =
      Math.abs(coords.lat - c.lat) > 0.00025 || Math.abs(coords.lng - c.lng) > 0.00025;
    results.push({
      id: c.id,
      lat: coords.lat,
      lng: coords.lng,
      changed,
    });
  }

  onProgress?.(results.length, results.length);
  // Uma única notificação no final (sem pinch dos pins)
  if (onBatch) {
    onBatch(results.filter((r) => r.changed));
  }
  saveCache(cache, true);
  return results;
}

export type EnrichCoordResult = {
  id: string | number;
  lat: number;
  lng: number;
  changed: boolean;
  neighborhood?: string | null;
};

/**
 * Refine por rua via Nominatim (1 req por vez, cache, validação pelo bairro).
 * Seguro para rodar em background após o mapa já ter pins aproximados.
 */
export async function refineStreetCoordinates(input: GeocodeInput): Promise<Coords | null> {
  const street = normalizeStreetName(input.address);
  if (!street) return null;

  const tokens = significantStreetTokens(street);
  if (tokens.length === 0) return null;

  const cache = loadCache();
  const seed = locationSeed(input);
  const streetKey = `street9:${seed}`;
  const missKey = `street9miss:${seed}`;

  const cached = asCoords(cache[streetKey]);
  if (cached) return cached;
  if (cache[missKey] === '1') return null;

  const neighborhood = pickNeighborhood(input);
  const isFortaleza = isFortalezaCity(input.city);
  const known = isFortaleza ? findFortalezaNeighborhood(neighborhood) : null;
  const cityCenter = resolveCityCenter(input.city, input.state);
  const bias = known ? { lat: known.lat, lng: known.lng } : cityCenter;
  if (!bias) return null;

  const coords = await geocodeByStreetQuery(
    { ...input, neighborhood: neighborhood || input.neighborhood },
    bias
  );

  const maxKm = known ? 2.8 : 14;
  if (!coords || kmBetween(coords, bias) > maxKm) {
    cache[missKey] = '1';
    saveCache(cache);
    return null;
  }

  // Número só dá um empurrão leve — a âncora já é a rua no OSM
  const refined = offsetByHouseNumber(coords, input.number, 0.22);
  const final = scatterInArea(refined, seed, 0.00012);

  cache[streetKey] = final;
  cache[`v9:${seed}`] = final;
  delete cache[missKey];
  saveCache(cache);
  return final;
}

export type StreetRefineOptions = {
  signal?: AbortSignal;
  /** Tempo máximo total do refine (default 8 min). */
  maxMs?: number;
  /** Quantos pins atualizar por flush de UI (default 10). */
  flushEvery?: number;
  /** Prioriza estes ids (ex.: visitas do dia) no refine de rede. */
  priorityIds?: Set<string> | string[];
  onProgress?: (done: number, total: number) => void;
  onBatch?: (partial: EnrichCoordResult[]) => void;
};

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function waitUntilTabVisible(signal?: AbortSignal): Promise<void> {
  if (typeof document === 'undefined' || !document.hidden) return;
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onVis = () => {
      if (!document.hidden) {
        document.removeEventListener('visibilitychange', onVis);
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }
    };
    const onAbort = () => {
      document.removeEventListener('visibilitychange', onVis);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    document.addEventListener('visibilitychange', onVis);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function toGeocodeInput(c: {
  id: string | number;
  cep?: string | null;
  number?: string | null;
  streetNumber?: string | null;
  neighborhood?: string | null;
  neighborhoodName?: string | null;
  address?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
}): GeocodeInput {
  return {
    id: c.id,
    cep: c.cep,
    number: c.streetNumber || c.number,
    neighborhood: c.neighborhoodName || c.neighborhood,
    address: c.streetAddress || c.address,
    city: c.city,
    state: c.state,
  };
}

/**
 * Refine de rua: 1) aplica cache em massa (sem rede), 2) Nominatim só no que falta.
 */
export async function refineStreetCoordinatesBatch(
  companies: Array<{
    id: string | number;
    lat: number;
    lng: number;
    cep?: string | null;
    number?: string | null;
    streetNumber?: string | null;
    neighborhood?: string | null;
    neighborhoodName?: string | null;
    address?: string | null;
    streetAddress?: string | null;
    city?: string | null;
    state?: string | null;
  }>,
  options?: StreetRefineOptions
): Promise<EnrichCoordResult[]> {
  const signal = options?.signal;
  const maxMs = options?.maxMs ?? 8 * 60 * 1000;
  const flushEvery = options?.flushEvery ?? 10;
  const started = Date.now();
  const results: EnrichCoordResult[] = [];
  let pending: EnrichCoordResult[] = [];
  const cache = loadCache();

  const priority =
    options?.priorityIds instanceof Set
      ? options.priorityIds
      : new Set(options?.priorityIds || []);

  const candidates = companies.filter((c) => {
    const street = normalizeStreetName(c.streetAddress || c.address);
    if (!street) return false;
    return significantStreetTokens(street).length > 0;
  });

  // Visitas / prioritários primeiro; resto estável
  candidates.sort((a, b) => {
    const ap = priority.has(String(a.id)) ? 0 : 1;
    const bp = priority.has(String(b.id)) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return 0;
  });

  const flush = () => {
    if (!pending.length) return;
    options?.onBatch?.(pending);
    pending = [];
  };

  const pushIfChanged = (c: (typeof candidates)[number], coords: Coords) => {
    const changed =
      Math.abs(coords.lat - c.lat) > 0.00025 || Math.abs(coords.lng - c.lng) > 0.00025;
    if (!changed) return;
    const item: EnrichCoordResult = {
      id: c.id,
      lat: coords.lat,
      lng: coords.lng,
      changed: true,
    };
    results.push(item);
    pending.push(item);
    if (pending.length >= flushEvery) flush();
  };

  // Fase 1: hits de cache (zero rede) — um flush só
  const needNetwork: typeof candidates = [];
  for (const c of candidates) {
    if (signal?.aborted) break;
    const input = toGeocodeInput(c);
    const seed = locationSeed(input);
    const hit = asCoords(cache[`street9:${seed}`]);
    if (hit) {
      pushIfChanged(c, hit);
      continue;
    }
    if (cache[`street9miss:${seed}`] === '1') continue;
    needNetwork.push(c);
  }
  flush();
  options?.onProgress?.(candidates.length - needNetwork.length, candidates.length);

  // Fase 2: Nominatim só para misses
  let processed = candidates.length - needNetwork.length;
  for (const c of needNetwork) {
    if (signal?.aborted) break;
    if (Date.now() - started > maxMs) break;

    try {
      await waitUntilTabVisible(signal);
    } catch {
      break;
    }

    let coords: Coords | null = null;
    try {
      coords = await refineStreetCoordinates(toGeocodeInput(c));
    } catch {
      coords = null;
    }

    processed += 1;
    options?.onProgress?.(processed, candidates.length);

    if (coords) pushIfChanged(c, coords);

    // Cede o event loop só após rede (cache já foi sincronizado)
    try {
      await wait(20, signal);
    } catch {
      break;
    }
  }

  flush();
  flushGeocodeCache();
  return results;
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

/** Invalida caches antigos que amontoavam pins no centro / bairro errado. */
export function clearLegacyGeocodeCaches() {
  try {
    localStorage.removeItem('FORTALEZA_GEOCODE_CACHE_V2');
    localStorage.removeItem('FORTALEZA_GEOCODE_CACHE_V3');
    localStorage.removeItem('FORTALEZA_GEOCODE_CACHE_V4');
    localStorage.removeItem('FORTALEZA_GEOCODE_CACHE_V5');
    localStorage.removeItem('FORTALEZA_GEOCODE_CACHE_V6');
    localStorage.removeItem('FORTALEZA_GEOCODE_CACHE_V7');
    localStorage.removeItem('FORTALEZA_GEOCODE_CACHE_V8');
  } catch {
    /* ignore */
  }
  // Mantém V9 em memória/localStorage — só limpa legado
}

export { slugifyNeighborhood };
