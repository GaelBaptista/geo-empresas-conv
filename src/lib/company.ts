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
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/** Nome por extenso → UF (API às vezes manda "Pernambuco", "SP", "Ceará"...). */
const STATE_NAME_TO_UF: Record<string, string> = {
  AC: 'AC',
  ACRE: 'AC',
  AL: 'AL',
  ALAGOAS: 'AL',
  AP: 'AP',
  AMAPA: 'AP',
  AM: 'AM',
  AMAZONAS: 'AM',
  BA: 'BA',
  BAHIA: 'BA',
  CE: 'CE',
  CEARA: 'CE',
  DF: 'DF',
  'DISTRITO FEDERAL': 'DF',
  ES: 'ES',
  'ESPIRITO SANTO': 'ES',
  GO: 'GO',
  GOIAS: 'GO',
  MA: 'MA',
  MARANHAO: 'MA',
  MT: 'MT',
  'MATO GROSSO': 'MT',
  MS: 'MS',
  'MATO GROSSO DO SUL': 'MS',
  MG: 'MG',
  'MINAS GERAIS': 'MG',
  PA: 'PA',
  PARA: 'PA',
  PB: 'PB',
  PARAIBA: 'PB',
  PR: 'PR',
  PARANA: 'PR',
  PE: 'PE',
  PERNAMBUCO: 'PE',
  PI: 'PI',
  PIAUI: 'PI',
  RJ: 'RJ',
  'RIO DE JANEIRO': 'RJ',
  RN: 'RN',
  'RIO GRANDE DO NORTE': 'RN',
  RS: 'RS',
  'RIO GRANDE DO SUL': 'RS',
  RO: 'RO',
  RONDONIA: 'RO',
  RR: 'RR',
  RORAIMA: 'RR',
  SC: 'SC',
  'SANTA CATARINA': 'SC',
  SP: 'SP',
  'SAO PAULO': 'SP',
  SE: 'SE',
  SERGIPE: 'SE',
  TO: 'TO',
  TOCANTINS: 'TO',
};

/** UF → nome amigável no filtro. */
export const STATE_LABELS: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};

export function formatStateLabel(uf: string): string {
  const key = normalizeState(uf);
  const name = STATE_LABELS[key];
  return name ? `${key} · ${name}` : key;
}

export function getCompanyState(company: Pick<Company, 'state' | 'city'>): string {
  const raw = normalizeState(company.state);
  if (raw) {
    if (STATE_NAME_TO_UF[raw]) return STATE_NAME_TO_UF[raw];
    // "CE - Ceará", "SP/São Paulo"
    const two = raw.slice(0, 2);
    if (/^[A-Z]{2}$/.test(two) && STATE_LABELS[two] && (raw.length === 2 || /[\s\-\/]/.test(raw[2] || ''))) {
      return two;
    }
    if (raw.length === 2 && STATE_LABELS[raw]) return raw;
    // tenta sem hífens/extra
    const compact = raw.replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (STATE_NAME_TO_UF[compact]) return STATE_NAME_TO_UF[compact];
  }

  // Fallback por cidade conhecida (só quando state da API veio vazio)
  const city = normalizeCity(company.city);
  if (
    city.includes('fortaleza') ||
    city.includes('caucaia') ||
    city.includes('maracanau') ||
    city.includes('pacajus') ||
    city.includes('sobral') ||
    city.includes('juazeiro do norte')
  ) {
    return 'CE';
  }
  if (city.includes('recife') || city.includes('olinda') || city.includes('jaboatao')) return 'PE';
  if (city.includes('joao pessoa') || city.includes('campina grande')) return 'PB';
  if (
    city.includes('sao paulo') ||
    city.includes('campinas') ||
    city.includes('guarulhos') ||
    city.includes('santos')
  ) {
    return 'SP';
  }
  if (city.includes('salvador') || city.includes('feira de santana')) return 'BA';
  if (city.includes('natal') || city.includes('mossoro')) return 'RN';
  if (city.includes('maceio')) return 'AL';
  if (city.includes('teresina')) return 'PI';
  if (city.includes('sao luis')) return 'MA';
  if (city.includes('aracaju')) return 'SE';
  if (city.includes('belo horizonte')) return 'MG';
  if (city.includes('rio de janeiro') || city.includes('niteroi')) return 'RJ';
  if (city.includes('curitiba')) return 'PR';
  if (city.includes('porto alegre')) return 'RS';
  if (city.includes('florianopolis')) return 'SC';
  if (city.includes('brasilia')) return 'DF';
  if (city.includes('goiania')) return 'GO';
  if (city.includes('belem')) return 'PA';
  if (city.includes('manaus')) return 'AM';

  return '—';
}

/** Estados distintos presentes nas empresas (sempre UF canônica). */
export function listStates(companies: Company[]): string[] {
  const set = new Set<string>();
  companies.forEach((c) => {
    const st = getCompanyState(c);
    if (st && st !== '—') set.add(st);
  });
  return Array.from(set).sort((a, b) => {
    // Ceará primeiro (base do time), depois alfabético
    if (a === 'CE' && b !== 'CE') return -1;
    if (b === 'CE' && a !== 'CE') return 1;
    return a.localeCompare(b, 'pt-BR');
  });
}

export function filterByState(companies: Company[], state: string | 'ALL'): Company[] {
  if (state === 'ALL') return companies;
  const key = normalizeState(state);
  const uf = STATE_NAME_TO_UF[key] || (key.length === 2 ? key : key);
  return companies.filter((c) => getCompanyState(c) === uf);
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

/**
 * Cota de estagiários a partir do quadro CLT (amount_clt):
 * 1–5 → 1 · 6–10 → 2 · 11–25 → 5 · 26+ → 20% do CLT
 */
export function computeInternQuota(amountClt: number | null | undefined): number | null {
  const n = Number(amountClt);
  if (!Number.isFinite(n) || n < 1) return null;
  if (n <= 5) return 1;
  if (n <= 10) return 2;
  if (n <= 25) return 5;
  return Math.max(1, Math.round(n * 0.2));
}

/** Normaliza amount_clt vindo da API (número ou string). */
export function parseAmountClt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/\D/g, '') || NaN);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}
