import type { CompanyCategory, CompanyStatus, VisitStatus, VisitType } from '@/types';

export const COMPANY_CATEGORIES: CompanyCategory[] = [
  'Saúde & Medicina',
  'Educação & Cursos',
  'Tecnologia & Inovação',
  'Serviços Corporativos',
  'Gastronomia & Lazer',
  'Comércio & Varejo',
  'Outros',
];

export const COMPANY_STATUSES: CompanyStatus[] = [
  'Ativa',
  'Em Acompanhamento',
  'Visita Pendente',
  'Em Prospecção',
  'Inativa',
];

export const VISIT_TYPES: VisitType[] = [
  'Rotina',
  'Prospecção',
  'Suporte Técnico',
  'Renovação de Contrato',
  'Auditoria / Qualidade',
  'Treinamento',
];

export const VISIT_STATUSES: VisitStatus[] = [
  'Concluída',
  'Agendada',
  'Cancelada',
  'Reagendada',
];

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  Ativa: 'Ativa',
  'Em Acompanhamento': 'Acompanhamento',
  'Visita Pendente': 'Visita Pendente',
  'Em Prospecção': 'Prospecção',
  Inativa: 'Inativa',
};

export function getCompanyStatusColor(status: CompanyStatus | string): string {
  switch (status) {
    case 'Ativa':
      return '#10b981';
    case 'Em Acompanhamento':
      return '#0ea5e9';
    case 'Visita Pendente':
      return '#f59e0b';
    case 'Em Prospecção':
      return '#8b5cf6';
    default:
      return '#64748b';
  }
}

export const VIEW_META = {
  map: {
    title: 'Mapa de empresas',
    description: 'Localize empresas conveniadas por cidade e bairro',
  },
  visits: {
    title: 'Agenda de visitas',
    description: 'Agendamentos do Estagius (somente leitura)',
  },
  ranking: {
    title: 'Ranking DrVagas',
    description: 'Empresas que mais aprovam e reprovam candidatos',
  },
} as const;
