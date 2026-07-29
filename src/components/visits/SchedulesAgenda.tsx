import { useMemo, useState } from 'react';
import { Search, Calendar, Building2, AlertCircle, MapPin, Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { getCompanyDisplayName } from '@/lib/company';
import {
  formatScheduleDate,
  getUpcomingVisitSchedules,
  isUpcomingSchedule,
} from '@/lib/schedule-match';
import type { Company, ScheduleItem } from '@/types';

interface SchedulesAgendaProps {
  schedules: ScheduleItem[];
  companies: Company[];
  onSelectCompanyById: (companyId: string) => void;
  onFocusCompanyOnMap?: (companyId: string) => void;
  onLinkCompany?: (scheduleId: string, companyId: string) => void;
  onUnlinkCompany?: (scheduleId: string) => void;
}

type FilterMode = 'visits_upcoming' | 'visits_all' | 'all' | 'unmatched';

export function SchedulesAgenda({
  schedules,
  companies,
  onSelectCompanyById,
  onFocusCompanyOnMap,
  onLinkCompany,
  onUnlinkCompany,
}: SchedulesAgendaProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('visits_upcoming');

  const upcomingVisits = useMemo(() => getUpcomingVisitSchedules(schedules), [schedules]);

  const companyOptions = useMemo(
    () =>
      [...companies]
        .sort((a, b) =>
          getCompanyDisplayName(a).localeCompare(getCompanyDisplayName(b), 'pt-BR')
        )
        .map((c) => ({
          value: c.id,
          label: getCompanyDisplayName(c),
          hint: c.city || undefined,
        })),
    [companies]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return schedules
      .filter((item) => {
        if (filterMode === 'visits_upcoming') {
          if (!item.isVisit || !isUpcomingSchedule(item)) return false;
        } else if (filterMode === 'visits_all') {
          if (!item.isVisit) return false;
        } else if (filterMode === 'unmatched') {
          if (!item.isVisit || item.matchedCompanyId) return false;
        }

        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          (item.matchedCompanyName || '').toLowerCase().includes(q) ||
          (item.apiCompanyName || '').toLowerCase().includes(q) ||
          (item.extractedCompanyName || '').toLowerCase().includes(q) ||
          (item.responsibleName || '').toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [schedules, searchQuery, filterMode]);

  const hasFilters = searchQuery || filterMode !== 'visits_upcoming';

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por empresa, título ou responsável..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
              <SelectTrigger className="sm:w-[260px]">
                <SelectValue placeholder="Filtro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visits_upcoming">
                  Visitas próximas ({upcomingVisits.length})
                </SelectItem>
                <SelectItem value="visits_all">Todas as visitas</SelectItem>
                <SelectItem value="unmatched">Visitas sem empresa no mapa</SelectItem>
                <SelectItem value="all">Toda a agenda</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('visits_upcoming');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-sm text-muted-foreground">
          {filtered.length} agendamento(s) · somente leitura (Estagius)
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <Calendar className="size-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">Nenhum agendamento encontrado</p>
            <p className="text-xs text-muted-foreground">
              Ajuste os filtros ou confira se há visitas na agenda do Estagius.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <ScheduleCard
              key={item.id}
              item={item}
              companyOptions={companyOptions}
              onSelectCompanyById={onSelectCompanyById}
              onFocusCompanyOnMap={onFocusCompanyOnMap}
              onLinkCompany={onLinkCompany}
              onUnlinkCompany={onUnlinkCompany}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleCard({
  item,
  companyOptions,
  onSelectCompanyById,
  onFocusCompanyOnMap,
  onLinkCompany,
  onUnlinkCompany,
}: {
  item: ScheduleItem;
  companyOptions: Array<{ value: string; label: string; hint?: string }>;
  onSelectCompanyById: (companyId: string) => void;
  onFocusCompanyOnMap?: (companyId: string) => void;
  onLinkCompany?: (scheduleId: string, companyId: string) => void;
  onUnlinkCompany?: (scheduleId: string) => void;
}) {
  const unmatched = item.isVisit && !item.matchedCompanyId;
  const isManual = item.matchConfidence === 'manual';

  return (
    <Card className={unmatched ? 'border-amber-200/80' : undefined}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {item.isVisit ? (
                <Badge variant="warning">Visita</Badge>
              ) : (
                <Badge variant="secondary">{item.type || 'Agenda'}</Badge>
              )}
              <Badge variant="outline">{item.status}</Badge>
              {unmatched && (
                <Badge variant="outline" className="text-amber-700 border-amber-300">
                  Sem match
                </Badge>
              )}
              {isManual && (
                <Badge variant="outline" className="text-teal-700 border-teal-300">
                  Vínculo manual
                </Badge>
              )}
              {item.matchConfidence === 'id' && (
                <Badge variant="outline" className="text-sky-700 border-sky-300">
                  Empresa do Estagius
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-snug">{item.title}</h3>
            {item.apiCompanyName &&
              item.apiCompanyName !== item.title &&
              item.apiCompanyName !== item.matchedCompanyName && (
                <p className="text-xs text-muted-foreground truncate">
                  Empresa na agenda: {item.apiCompanyName}
                </p>
              )}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="size-3.5 shrink-0" />
              {formatScheduleDate(item.startsAt)}
              {item.responsibleName ? ` · ${item.responsibleName}` : ''}
            </p>
          </div>
        </div>

        {item.description && item.description !== item.title && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {item.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
          {item.matchedCompanyId ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectCompanyById(item.matchedCompanyId!)}
              >
                <Building2 />
                {item.matchedCompanyName || 'Empresa'}
              </Button>
              {onFocusCompanyOnMap && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFocusCompanyOnMap(item.matchedCompanyId!)}
                >
                  <MapPin />
                  Ver no mapa
                </Button>
              )}
              {isManual && onUnlinkCompany && (
                <Button variant="ghost" size="sm" onClick={() => onUnlinkCompany(item.id)}>
                  <Unlink />
                  Desvincular
                </Button>
              )}
            </>
          ) : item.isVisit ? (
            <div className="w-full space-y-2">
              <p className="text-xs text-amber-800 flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" />
                Não casou automaticamente
                {item.extractedCompanyName ? ` (“${item.extractedCompanyName}”)` : ''}
              </p>
              {onLinkCompany && (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="flex-1 min-w-0">
                    <SearchableSelect
                      value=""
                      options={companyOptions}
                      placeholder="Escolher empresa no mapa..."
                      searchPlaceholder="Buscar empresa..."
                      onChange={(companyId) => {
                        if (companyId) onLinkCompany(item.id, companyId);
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                    <Link2 className="size-3" />
                    Só neste aparelho
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Item de agenda (não é visita)</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
