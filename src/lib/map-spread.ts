import type { Company } from '@/types';

type PositionedCompany = Company & { mapLat: number; mapLng: number };

function coordKey(lat: number, lng: number): string {
  // ~55m — agrupa pins quase no mesmo ponto sem juntar bairros vizinhos
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/**
 * Espalha empresas com a mesma coordenada em anéis,
 * para não empilhar pins quando CEP/bairro colapsam no mesmo ponto.
 */
export function spreadOverlappingCompanies(
  companies: Company[],
  radiusDegrees = 0.0011
): PositionedCompany[] {
  const groups = new Map<string, Company[]>();

  companies.forEach((company) => {
    const key = coordKey(company.lat, company.lng);
    const list = groups.get(key) || [];
    list.push(company);
    groups.set(key, list);
  });

  const result: PositionedCompany[] = [];

  groups.forEach((group) => {
    if (group.length === 1) {
      const only = group[0];
      result.push({ ...only, mapLat: only.lat, mapLng: only.lng });
      return;
    }

    group.forEach((company, index) => {
      const perRing = 8;
      const ring = Math.floor(index / perRing);
      const indexInRing = index % perRing;
      const countInRing = Math.min(perRing, group.length - ring * perRing);
      const angle = (2 * Math.PI * indexInRing) / countInRing - Math.PI / 2;
      // raio cresce mais quando há muitos no mesmo ponto
      const radius = radiusDegrees * (1 + ring * 1.35) * (1 + Math.min(1.5, group.length / 40));

      result.push({
        ...company,
        mapLat: company.lat + Math.sin(angle) * radius,
        mapLng: company.lng + Math.cos(angle) * radius * 1.12,
      });
    });
  });

  return result;
}
