export type CompanyStatus = 'Ativa' | 'Em Acompanhamento' | 'Visita Pendente' | 'Em Prospecção' | 'Inativa';

export type VisitType = 'Rotina' | 'Prospecção' | 'Suporte Técnico' | 'Renovação de Contrato' | 'Auditoria / Qualidade' | 'Treinamento';

export type VisitStatus = 'Concluída' | 'Agendada' | 'Cancelada' | 'Reagendada';

export type CompanyCategory = 
  | 'Saúde & Medicina' 
  | 'Educação & Cursos' 
  | 'Tecnologia & Inovação' 
  | 'Serviços Corporativos' 
  | 'Gastronomia & Lazer' 
  | 'Comércio & Varejo' 
  | 'Outros';

export interface Neighborhood {
  id: string;
  name: string;
  description: string;
  center: [number, number]; // [lat, lng]
  color: string;
  zone: 'Norte' | 'Sul' | 'Leste' | 'Oeste' | 'Centro';
  city: string;
}

export interface Company {
  id: string;
  name: string;
  tradeName?: string;
  cnpj?: string;
  logoUrl: string;
  neighborhoodId: string;
  neighborhoodName: string;
  category: CompanyCategory;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  contactRole?: string;
  status: CompanyStatus;
  lat: number;
  lng: number;
  convenioDate: string;
  description?: string;
  totalVisits: number;
  lastVisitDate?: string;
  nextScheduledVisit?: string;
  /** Contratos/estagiários ativos (meta da API) */
  activeTrainees?: number;
  inactiveTrainees?: number;
  city?: string;
  state?: string;
  /** Campos brutos para geocode de rua em segundo plano */
  streetAddress?: string | null;
  streetNumber?: string | null;
  cep?: string | null;
  /** ID numérico da API (para cruzar com contratos/grupos) */
  apiId?: number;
  groupId?: number | null;
  groupName?: string;
}

export interface Visit {
  id: string;
  companyId: string;
  companyName: string;
  companyLogo: string;
  neighborhoodName: string;
  visitDate: string;
  visitorName: string;
  visitorRole?: string;
  visitType: VisitType;
  status: VisitStatus;
  rating: number; // 1 to 5
  summary: string;
  notes: string;
  followUpActions?: string;
  nextVisitDate?: string;
}

/** Item de agenda vindo de GET /schedules (somente leitura). */
export interface ScheduleItem {
  id: string;
  title: string;
  /** @deprecated use observations — mantido por compatibilidade */
  description?: string;
  /** Campo `observations` da agenda Estagius */
  observations?: string;
  type: string;
  status: string;
  startsAt: string;
  endsAt?: string;
  responsibleName?: string;
  /** company_id da API, se a empresa foi selecionada na agenda */
  apiCompanyId?: number | null;
  /** company_name / fantasy_name vindo da agenda (Estagius) */
  apiCompanyName?: string | null;
  /** Trecho do título usado no match (ex.: nome fantasia) */
  extractedCompanyName?: string | null;
  /** Company.id local (`api-123`) quando casou */
  matchedCompanyId?: string | null;
  matchedCompanyName?: string | null;
  isVisit: boolean;
  matchConfidence: 'id' | 'exact' | 'fuzzy' | 'none' | 'manual';
}

export type ViewMode = 'map' | 'visits' | 'ranking';
