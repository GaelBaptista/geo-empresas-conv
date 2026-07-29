import { Badge } from '@/components/ui/badge';
import { COMPANY_STATUS_LABELS } from '@/constants/domain';
import type { CompanyStatus, VisitStatus } from '@/types';

const companyVariant: Record<
  CompanyStatus,
  'success' | 'info' | 'warning' | 'prospect' | 'muted'
> = {
  Ativa: 'success',
  'Em Acompanhamento': 'info',
  'Visita Pendente': 'warning',
  'Em Prospecção': 'prospect',
  Inativa: 'muted',
};

export function StatusBadge({ status }: { status: CompanyStatus }) {
  return (
    <Badge variant={companyVariant[status] ?? 'muted'}>
      {COMPANY_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

const visitVariant: Record<VisitStatus, 'success' | 'info' | 'warning' | 'muted'> = {
  Concluída: 'success',
  Agendada: 'info',
  Reagendada: 'warning',
  Cancelada: 'muted',
};

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  return <Badge variant={visitVariant[status] ?? 'muted'}>{status}</Badge>;
}
