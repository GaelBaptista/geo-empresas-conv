import type { Company } from '@/types';

type PositionedCompany = Company & { mapLat: number; mapLng: number };

function coordKey(lat: number, lng: number): string {
  // ~11m precision — agrupa pins praticamente no mesmo ponto
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Espalha empresas com a mesma coordenada em círculo,
 * para não empilhar pins quando o CEP/geocode é idêntico.
 */
export function spreadOverlappingCompanies(
  companies: Company[],
  radiusDegrees = 0.00045
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

    // círculo + anéis extras se houver muitos
    group.forEach((company, index) => {
      const ring = Math.floor(index / 8);
      const indexInRing = index % 8;
      const countInRing = Math.min(8, group.length - ring * 8);
      const angle = (2 * Math.PI * indexInRing) / countInRing - Math.PI / 2;
      const radius = radiusDegrees * (ring + 1);

      result.push({
        ...company,
        mapLat: company.lat + Math.sin(angle) * radius,
        mapLng: company.lng + Math.cos(angle) * radius,
      });
    });
  });

  return result;
}
