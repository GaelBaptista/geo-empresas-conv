import { api } from '@/lib/api';
import { PRESET_LOGOS } from '@/data/fortalezaData';
import {
  extractNeighborhoodFromText,
  flushGeocodeCache,
  neighborhoodIdFromName,
  preloadCepCoordinates,
  refineStreetCoordinatesBatch,
  resolveCoordinatesFast,
  slugifyNeighborhood,
} from '@/lib/geocode';
import { getCompanyCity, isValidNeighborhoodName, parseAmountClt, computeInternQuota } from '@/lib/company';
import type { ApiCompaniesResponse, ApiCompany } from '@/types/api';
import type { Company, CompanyStatus, Neighborhood } from '@/types';

const OTHER_NEIGHBORHOOD_NAME = 'Outros / sem bairro';

function unwrapCompanies(payload: ApiCompaniesResponse): ApiCompany[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function resolveNeighborhood(
  raw: string | null | undefined,
  cityLabel: string
): { id: string; name: string } {
  const trimmed = (raw || '').trim();
  const citySlug = slugifyNeighborhood(cityLabel) || 'sem_cidade';

  if (!isValidNeighborhoodName(trimmed)) {
    return { id: `${citySlug}_outros`, name: OTHER_NEIGHBORHOOD_NAME };
  }

  return {
    id: neighborhoodIdFromName(trimmed, cityLabel),
    name: trimmed,
  };
}

function buildAddress(apiCompany: ApiCompany, neighborhoodName: string): string {
  const parts = [
    apiCompany.address,
    apiCompany.number ? `nº ${apiCompany.number}` : null,
    apiCompany.complement,
    neighborhoodName !== OTHER_NEIGHBORHOOD_NAME ? neighborhoodName : null,
    apiCompany.city && apiCompany.state
      ? `${apiCompany.city} - ${apiCompany.state}`
      : apiCompany.city || apiCompany.state,
    apiCompany.cep ? `CEP ${apiCompany.cep}` : null,
  ].filter(Boolean);

  return parts.join(', ') || [apiCompany.city, apiCompany.state].filter(Boolean).join(' - ') || 'Brasil';
}

function deriveStatus(activeTrainees: number): CompanyStatus {
  if (activeTrainees > 0) return 'Ativa';
  return 'Em Acompanhamento';
}

function logoForId(id: number): string {
  return PRESET_LOGOS[id % PRESET_LOGOS.length];
}

export async function mapApiCompanyToCompany(apiCompany: ApiCompany): Promise<Company> {
  const stateUf = (apiCompany.state || '').trim().toUpperCase();
  const cityFromApi = apiCompany.city?.trim() || '';
  const cityLabel =
    cityFromApi ||
    (stateUf === 'CE' || stateUf === 'CEARA' || stateUf === 'CEARÁ'
      ? 'Fortaleza'
      : stateUf
        ? `Cidade (${stateUf})`
        : 'Sem cidade');

  // Bairro da API, ou extraído do endereço textual
  let neighborhoodRaw = (apiCompany.neighborhood || '').trim() || null;
  if (!isValidNeighborhoodName(neighborhoodRaw || undefined)) {
    neighborhoodRaw =
      extractNeighborhoodFromText(
        apiCompany.address,
        apiCompany.complement,
        apiCompany.city
      ) || neighborhoodRaw;
  }

  const { id: neighborhoodId, name: neighborhoodName } = resolveNeighborhood(
    neighborhoodRaw,
    cityLabel
  );

  const stateLabel = apiCompany.state?.trim() || undefined;

  const coords = await resolveCoordinatesFast({
    id: apiCompany.id,
    cep: apiCompany.cep,
    neighborhood:
      neighborhoodName === OTHER_NEIGHBORHOOD_NAME
        ? neighborhoodRaw || extractNeighborhoodFromText(apiCompany.address)
        : neighborhoodName,
    // Junta campos para extrair bairro mesmo se neighborhood vier vazio
    address: [apiCompany.address, apiCompany.neighborhood, apiCompany.city]
      .filter(Boolean)
      .join(', '),
    number: apiCompany.number,
    city: cityFromApi || cityLabel,
    state: stateLabel,
  });

  const email =
    apiCompany.rh_analyst?.trim() ||
    apiCompany.supervisor?.trim() ||
    apiCompany.email_signature?.trim() ||
    '';

  const convenioDate = apiCompany.agreement_start_date
    ? apiCompany.agreement_start_date.slice(0, 10)
    : apiCompany.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);

  const activeTrainees = Number(apiCompany.__meta__?.qtd_contracts_actives ?? 0);
  const inactiveTrainees = Number(apiCompany.__meta__?.qtd_contracts_inactives ?? 0);
  const amountClt = parseAmountClt(apiCompany.amount_clt);
  const internQuota = computeInternQuota(amountClt);
  const fantasy = apiCompany.fantasy_name?.trim() || undefined;

  return {
    id: `api-${apiCompany.id}`,
    apiId: apiCompany.id,
    name: apiCompany.company_name.trim(),
    tradeName: fantasy,
    cnpj: apiCompany.cnpj || undefined,
    logoUrl: logoForId(apiCompany.id),
    neighborhoodId,
    neighborhoodName,
    category: 'Outros',
    address: buildAddress(apiCompany, neighborhoodName),
    phone: apiCompany.contact?.trim() || '—',
    email: email || '—',
    contactPerson: apiCompany.responsible?.trim() || email || 'Contato RH',
    contactRole: 'RH / Responsável',
    status: deriveStatus(activeTrainees),
    lat: coords.lat,
    lng: coords.lng,
    convenioDate,
    totalVisits: 0,
    activeTrainees,
    inactiveTrainees,
    amountClt,
    internQuota,
    city: cityLabel,
    state: apiCompany.state?.trim() || undefined,
    streetAddress: apiCompany.address,
    streetNumber: apiCompany.number,
    cep: apiCompany.cep,
    groupId: apiCompany.group_id ?? null,
  };
}

async function mapInBatches(items: ApiCompany[], batchSize = 48): Promise<Company[]> {
  const result: Company[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const mapped = await Promise.all(
      slice.map((item) =>
        mapApiCompanyToCompany(item).catch((err) => {
          console.warn('Falha ao mapear empresa', item.id, err);
          return null;
        })
      )
    );
    for (const company of mapped) {
      if (company) result.push(company);
    }
    // Cede o event loop entre lotes (evita freeze no load com muitas empresas)
    if (i + batchSize < items.length) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }
  flushGeocodeCache();
  return result;
}

export async function fetchCompaniesFromApi(): Promise<Company[]> {
  const { data } = await api.get<ApiCompaniesResponse>('/companies');
  const list = unwrapCompanies(data);
  // Resolve CEPs UMA vez antes de montar o mapa → pins fixos (sem se mexer ao dar zoom)
  await preloadCepCoordinates(
    list.map((c) => ({ cep: c.cep, state: c.state })),
    { maxMs: 18000, concurrency: 8 }
  );
  return mapInBatches(list);
}

/**
 * Compat / reload manual. Não usa update progressivo.
 */
export async function refineCompaniesByCep(
  companies: Company[],
  _onUpdate?: (next: Company[]) => void
): Promise<Company[]> {
  // Posições já vêm corretas no fetch; não re-mover pins em background.
  return companies;
}

export type RefineProgress = { done: number; total: number };

/**
 * Refine por rua em background (Nominatim, 1/s, cache + validação de bairro).
 * Atualiza o mapa em lotes — callback recebe só os pins que mudaram.
 */
export async function refineCompaniesStreetCoords(
  companies: Company[],
  onUpdate?: (changed: Array<{ id: string; lat: number; lng: number }>) => void,
  onProgress?: (progress: RefineProgress) => void,
  options?: { signal?: AbortSignal; maxMs?: number; priorityIds?: Set<string> | string[] }
): Promise<Company[]> {
  if (!companies.length) return companies;

  const byId = new Map(companies.map((c) => [c.id, { ...c }]));

  await refineStreetCoordinatesBatch(companies, {
    signal: options?.signal,
    maxMs: options?.maxMs,
    flushEvery: 10,
    priorityIds: options?.priorityIds,
    onProgress: (done, total) => onProgress?.({ done, total }),
    onBatch: (partial) => {
      if (!partial.length) return;
      const changed: Array<{ id: string; lat: number; lng: number }> = [];
      for (const item of partial) {
        const id = String(item.id);
        const current = byId.get(id);
        if (!current) continue;
        byId.set(id, { ...current, lat: item.lat, lng: item.lng });
        changed.push({ id, lat: item.lat, lng: item.lng });
      }
      if (changed.length) onUpdate?.(changed);
    },
  });

  return companies.map((c) => byId.get(c.id) || c);
}

export function enrichCompaniesWithGroupsAndContracts(
  companies: Company[],
  groups: { id: number; label: string }[],
  activeCounts: Map<number, number>
): Company[] {
  const groupNames = new Map(groups.map((g) => [g.id, g.label]));

  return companies.map((company) => {
    const apiId = company.apiId;
    const fromContracts =
      apiId != null && activeCounts.has(apiId) ? activeCounts.get(apiId)! : undefined;
    const activeTrainees =
      fromContracts !== undefined ? fromContracts : (company.activeTrainees ?? 0);
    const groupId = company.groupId ?? null;

    return {
      ...company,
      activeTrainees,
      status: deriveStatus(activeTrainees),
      groupId,
      groupName: groupId != null ? groupNames.get(groupId) : undefined,
    };
  });
}

const NEIGHBORHOOD_COLORS = [
  '#0284c7',
  '#0d9488',
  '#ea580c',
  '#7c3aed',
  '#16a34a',
  '#db2777',
  '#2563eb',
  '#4f46e5',
  '#ca8a04',
  '#059669',
  '#e11d48',
  '#0891b2',
];

const ZONE_ORDER: Neighborhood['zone'][] = ['Centro', 'Leste', 'Oeste', 'Norte', 'Sul'];

export function buildNeighborhoodsFromCompanies(
  companies: Company[],
  base: Neighborhood[]
): Neighborhood[] {
  const byId = new Map<string, Neighborhood>();

  // base só entra se houver empresa usando o id
  const usedIds = new Set(companies.map((c) => c.neighborhoodId));
  base.forEach((n) => {
    if (usedIds.has(n.id)) byId.set(n.id, { ...n });
  });

  companies.forEach((company, index) => {
    const city = getCompanyCity(company);
    if (byId.has(company.neighborhoodId)) {
      const existing = byId.get(company.neighborhoodId)!;
      existing.name = company.neighborhoodName;
      existing.city = city;
      return;
    }

    byId.set(company.neighborhoodId, {
      id: company.neighborhoodId,
      name: company.neighborhoodName,
      description: `Bairro de ${company.neighborhoodName}, ${city}.`,
      center: [company.lat, company.lng],
      color: NEIGHBORHOOD_COLORS[index % NEIGHBORHOOD_COLORS.length],
      zone: company.neighborhoodId.endsWith('_outros') ? 'Centro' : 'Sul',
      city,
    });
  });

  const groups = new Map<string, Company[]>();
  companies.forEach((c) => {
    const list = groups.get(c.neighborhoodId) || [];
    list.push(c);
    groups.set(c.neighborhoodId, list);
  });

  for (const id of Array.from(byId.keys())) {
    if (!usedIds.has(id)) {
      byId.delete(id);
      continue;
    }
    const list = groups.get(id) || [];
    const neigh = byId.get(id);
    if (!neigh || list.length === 0) continue;
    neigh.center = [
      list.reduce((s, c) => s + c.lat, 0) / list.length,
      list.reduce((s, c) => s + c.lng, 0) / list.length,
    ];
  }

  return Array.from(byId.values()).sort((a, b) => {
    const cityDiff = a.city.localeCompare(b.city, 'pt-BR');
    if (cityDiff !== 0) return cityDiff;
    const zoneDiff = ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone);
    if (zoneDiff !== 0) return zoneDiff;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}
