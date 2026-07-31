import type { Company } from '@/types';

/** Nome exibido: prioriza nome fantasia. */
export function getCompanyDisplayName(company: Company): string {
  const fantasy = company.tradeName?.trim();
  if (fantasy) return fantasy;
  return company.name.trim();
}

/** Detecta valores inválidos que a API às vezes manda no campo neighborhood. */
export function isValidNeighborhoodName(raw: string | null | undefined): boolean {
  const name = (raw || '').trim();
  if (name.length < 3) return false;
  if (/^\d+$/.test(name)) return false;
  if (/\(\s*\d{2}\s*\)/.test(name)) return false;
  if (/\d{4,}-\d{4}/.test(name)) return false;
  if (/@/.test(name)) return false;
  if (/https?:\/\//i.test(name)) return false;
  if (!/[a-záàâãéèêíïóôõöúçñ]/i.test(name)) return false;
  return true;
}

export function normalizeCity(city: string | null | undefined): string {
  return (city || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Cidade padrão ao abrir o mapa (filtro inicial). */
export const DEFAULT_MAP_CITY = 'Fortaleza';

export function pickDefaultCity(cities: string[]): string {
  const fortaleza = cities.find((c) => normalizeCity(c).includes('fortaleza'));
  if (fortaleza) return fortaleza;
  return cities[0] || DEFAULT_MAP_CITY;
}

export function getCompanyCity(company: Pick<Company, 'city' | 'state'>): string {
  const raw = (company.city || '').trim();
  if (raw) return raw;
  const state = (company.state || '').trim().toUpperCase();
  if (state === 'CE' || state === 'CEARA' || state === 'CEARÁ') return DEFAULT_MAP_CITY;
  if (state) return `Cidade (${state})`;
  return 'Sem cidade';
}

/** Lista de cidades distintas; Fortaleza primeiro (padrão do app). */
export function listCities(companies: Company[]): string[] {
  const map = new Map<string, string>();
  companies.forEach((c) => {
    const label = getCompanyCity(c);
    const key = normalizeCity(label);
    if (!map.has(key)) map.set(key, label);
  });

  return Array.from(map.values()).sort((a, b) => {
    const aFort = normalizeCity(a).includes('fortaleza');
    const bFort = normalizeCity(b).includes('fortaleza');
    if (aFort && !bFort) return -1;
    if (!aFort && bFort) return 1;
    return a.localeCompare(b, 'pt-BR');
  });
}

export function filterByCity(companies: Company[], city: string | 'ALL'): Company[] {
  if (city === 'ALL') return companies;
  const key = normalizeCity(city);
  return companies.filter((c) => normalizeCity(getCompanyCity(c)) === key);
}

export function normalizeState(state: string | null | undefined): string {
  return (state || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function getCompanyState(company: Pick<Company, 'state' | 'city'>): string {
  const raw = normalizeState(company.state);
  const aliases: Record<string, string> = {
    CEARA: 'CE',
    PERNAMBUCO: 'PE',
    BAHIA: 'BA',
    PARAIBA: 'PB',
    'RIO GRANDE DO NORTE': 'RN',
    PIAUI: 'PI',
    MARANHAO: 'MA',
    ALAGOAS: 'AL',
    SERGIPE: 'SE',
  };
  if (raw) {
    if (aliases[raw]) return aliases[raw];
    if (raw.length === 2) return raw;
    return raw;
  }
  const city = normalizeCity(company.city);
  if (
    city.includes('fortaleza') ||
    city.includes('caucaia') ||
    city.includes('maracanau') ||
    city.includes('pacajus')
  ) {
    return 'CE';
  }
  return '—';
}

/** Estados distintos presentes nas empresas. */
export function listStates(companies: Company[]): string[] {
  const set = new Set<string>();
  companies.forEach((c) => {
    const st = getCompanyState(c);
    if (st && st !== '—') set.add(st);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function filterByState(companies: Company[], state: string | 'ALL'): Company[] {
  if (state === 'ALL') return companies;
  const key = normalizeState(state);
  return companies.filter((c) => normalizeState(getCompanyState(c)) === key);
}

export function cityCenter(companies: Company[]): [number, number] {
  if (companies.length === 0) return [-3.7327, -38.527];

  const lat = companies.reduce((s, c) => s + c.lat, 0) / companies.length;
  const lng = companies.reduce((s, c) => s + c.lng, 0) / companies.length;

  // Se o filtro é uma cidade fora do CE mas a média caiu em Fortaleza, usa centro da cidade do filtro
  const sampleCity = normalizeCity(getCompanyCity(companies[0]));
  const looksLikeFortaleza = Math.abs(lat + 3.7327) < 0.4 && Math.abs(lng + 38.527) < 0.4;
  if (looksLikeFortaleza && sampleCity && !sampleCity.includes('fortaleza')) {
    const known: Record<string, [number, number]> = {
      salvador: [-12.9777, -38.5016],
      pacajus: [-4.1731846, -38.460945],
      caucaia: [-3.7361, -38.6531],
      maracanau: [-3.8769, -38.6259],
      recife: [-8.0476, -34.877],
      'sao paulo': [-23.5505, -46.6333],
      'rio de janeiro': [-22.9068, -43.1729],
    };
    if (known[sampleCity]) return known[sampleCity];
  }

  return [lat, lng];
}

export type InternFilter = 'all' | 'with_active' | 'without_active';

export function filterByInterns(companies: Company[], filter: InternFilter): Company[] {
  if (filter === 'with_active') {
    return companies.filter((c) => (c.activeTrainees ?? 0) > 0);
  }
  if (filter === 'without_active') {
    return companies.filter((c) => (c.activeTrainees ?? 0) === 0);
  }
  return companies;
}

export function filterByGroup(
  companies: Company[],
  groupId: number | 'ALL'
): Company[] {
  if (groupId === 'ALL') return companies;
  return companies.filter((c) => c.groupId === groupId);
}
