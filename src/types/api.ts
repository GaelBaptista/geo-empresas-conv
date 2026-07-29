export interface ApiCompanyMeta {
  qtd_contracts_actives?: string;
  qtd_contracts_inactives?: string;
}

export interface ApiCompany {
  id: number;
  cnpj: string | null;
  company_name: string;
  contact: string | null;
  cep: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  number: string | null;
  complement: string | null;
  rh_analyst: string | null;
  supervisor: string | null;
  integration_agent_value: number | null;
  institution_value: number | null;
  created_at: string;
  updated_at: string;
  agreement_start_date: string | null;
  application_id: string | null;
  type_charge: string | null;
  fantasy_name: string | null;
  group_id: number | null;
  integration_agent_higher_education_value: number | null;
  amount_clt: number | null;
  email_signature: string | null;
  municipal_registration: string | null;
  type_taxation: string | null;
  city_code: string | null;
  iss_retain: boolean | null;
  responsible: string | null;
  __meta__?: ApiCompanyMeta;
}

export type ApiCompaniesResponse =
  | ApiCompany[]
  | {
      data: ApiCompany[];
      meta?: unknown;
    };

export interface ApiGroupOption {
  value: number;
  label: string;
}

export interface ApiActiveContract {
  id: number;
  trainee_id: number;
  company_id: number;
  unit_city: string | null;
  status: boolean;
  company?: ApiCompany | null;
  trainee?: {
    id: number;
    name: string;
    cpf?: string;
    city?: string;
    neighborhood?: string;
  } | null;
}

export type ApiListResponse<T> = T[] | { data: T[]; meta?: unknown };

/** Agenda (GET /schedules) — formato real do Estagius. */
export interface ApiSchedule {
  id: number | string;
  description?: string | null;
  date?: string | null;
  hour?: string | null;
  observations?: string | null;
  private?: boolean | null;
  category?: number | string | null;
  createdBy?: string | null;
  /** Campos alternativos / legados */
  title?: string | null;
  name?: string | null;
  notes?: string | null;
  type?: string | null;
  status?: string | null;
  start_at?: string | null;
  start_date?: string | null;
  scheduled_at?: string | null;
  ends_at?: string | null;
  end_date?: string | null;
  /** Pode vir number ou string ("9") quando a empresa é selecionada na agenda. */
  company_id?: number | string | null;
  company_name?: string | null;
  company?: {
    id?: number | string;
    fantasy_name?: string | null;
    company_name?: string | null;
  } | null;
  user?: { id?: number; name?: string | null } | null;
  responsible?: string | null;
  [key: string]: unknown;
}
