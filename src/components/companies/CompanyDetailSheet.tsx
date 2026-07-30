import { MapPin, Phone, Mail, User, ClipboardList, Calendar, ExternalLink, Navigation, StickyNote, ThumbsDown, Building2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/companies/StatusBadge';
import { CompanyReputationCard } from '@/components/companies/CompanyReputationCard';
import { getCompanyDisplayName } from '@/lib/company';
import {
  formatScheduleDate,
  googleMapsCompanyUrl,
  isUpcomingSchedule,
} from '@/lib/schedule-match';
import type { CompanyMinivagasExtras } from '@/services/minivagasApi';
import type { Company, ScheduleItem } from '@/types';

interface CompanyDetailSheetProps {
  company: Company | null;
  schedules: ScheduleItem[];
  minivagasExtras?: CompanyMinivagasExtras | null;
  onClose: () => void;
  onFocusOnMap: (company: Company) => void;
}

export function CompanyDetailSheet({
  company,
  schedules,
  minivagasExtras = null,
  onClose,
  onFocusOnMap,
}: CompanyDetailSheetProps) {
  const companySchedules = company
    ? schedules
        .filter((s) => s.isVisit && s.matchedCompanyId === company.id)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    : [];

  return (
    <Sheet open={!!company} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="p-0 flex flex-col gap-0 overflow-hidden w-full sm:max-w-xl md:max-w-2xl max-w-[100vw]">
        {company && (
          <>
            <SheetHeader className="p-5 sm:p-6 bg-gradient-to-br from-primary to-sky-800 dark:from-sky-950 dark:to-blue-950 text-primary-foreground space-y-0 text-left shrink-0">
              <div className="flex items-start gap-3 sm:gap-4 pr-8 min-w-0">
                <div className="size-14 sm:size-16 rounded-2xl bg-white/10 border-2 border-white/20 shadow-md shrink-0 flex items-center justify-center">
                  <Building2 className="size-7 text-white/90" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/20">
                      {company.neighborhoodName}
                    </Badge>
                    <StatusBadge status={company.status} />
                  </div>
                  <SheetTitle className="text-white text-base sm:text-lg break-words">
                    {getCompanyDisplayName(company)}
                  </SheetTitle>
                  <SheetDescription className="text-white/75 break-words">
                    {company.tradeName
                      ? `Razão social: ${company.name}`
                      : [company.city, company.groupName].filter(Boolean).join(' · ') ||
                        'Empresa conveniada'}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="p-4 bg-muted/50 border-b flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  onFocusOnMap(company);
                  onClose();
                }}
              >
                <MapPin />
                Ver no mapa
              </Button>
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <a href={googleMapsCompanyUrl(company)} target="_blank" rel="noreferrer">
                  <Navigation />
                  Google Maps
                  <ExternalLink className="size-3 opacity-70" />
                </a>
              </Button>
            </div>

            <ScrollArea className="flex-1 min-h-0 min-w-0">
              <div className="p-4 sm:p-6 space-y-5 w-full max-w-full overflow-x-hidden">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Dados do convênio</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <InfoField label="CNPJ" value={company.cnpj || 'Não informado'} />
                      <InfoField
                        label="Início do convênio"
                        value={company.convenioDate}
                      />
                      <div className="sm:col-span-2">
                        <span className="text-xs text-muted-foreground block mb-1">Endereço</span>
                        <p className="font-medium flex items-start gap-1.5 break-words">
                          <MapPin className="size-3.5 text-primary shrink-0 mt-0.5" />
                          <span>{company.address}</span>
                        </p>
                      </div>
                      {company.groupName && (
                        <InfoField label="Grupo" value={company.groupName} />
                      )}
                      <InfoField
                        label="Visitas na agenda"
                        value={String(companySchedules.length)}
                        emphasize
                      />
                      <div className="sm:col-span-2 space-y-1.5">
                        <span className="text-xs text-muted-foreground block">Telefone / e-mail</span>
                        <p className="flex items-center gap-1.5 text-sm">
                          <Phone className="size-3 text-muted-foreground shrink-0" />
                          <span className="break-all">{company.phone}</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-sm">
                          <Mail className="size-3 text-muted-foreground shrink-0" />
                          <span className="break-all">{company.email}</span>
                        </p>
                      </div>
                    </div>
                    {(company.activeTrainees != null || company.inactiveTrainees != null) && (
                      <>
                        <Separator />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 px-3 py-2.5">
                            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
                              Estagiários ativos
                            </p>
                            <p className="text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-100">
                              {company.activeTrainees ?? 0}
                            </p>
                          </div>
                          <div className="rounded-xl bg-muted px-3 py-2.5 border">
                            <p className="text-[11px] text-muted-foreground">Inativos</p>
                            <p className="text-lg font-bold tabular-nums">
                              {company.inactiveTrainees ?? 0}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {(minivagasExtras?.observacoes ||
                  (minivagasExtras &&
                    (minivagasExtras.reprovados > 0 ||
                      minivagasExtras.contratados > 0 ||
                      minivagasExtras.naoCompareceu > 0 ||
                      minivagasExtras.enviados > 0 ||
                      minivagasExtras.reprovadosMes > 0 ||
                      minivagasExtras.contratadosMes > 0 ||
                      minivagasExtras.naoCompareceuMes > 0))) && (
                  <div className="space-y-3">
                    {minivagasExtras.reputation &&
                      minivagasExtras.reputation.enviados > 0 && (
                        <CompanyReputationCard reputation={minivagasExtras.reputation} />
                      )}

                    <Card className="border-amber-200/70 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-amber-900 dark:text-amber-100">
                          <StickyNote className="size-3.5" />
                          Observações Minivagas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {minivagasExtras.observacoes && (
                          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                            {minivagasExtras.observacoes}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="bg-card">
                            {minivagasExtras.enviados} candidato(s)
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-100 dark:border-sky-800"
                          >
                            {minivagasExtras.contratados} contratados
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:border-rose-800"
                          >
                            <ThumbsDown className="size-3" />
                            {minivagasExtras.reprovados} reprovados
                          </Badge>
                          {minivagasExtras.naoCompareceu > 0 && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800"
                            >
                              {minivagasExtras.naoCompareceu} faltas
                            </Badge>
                          )}
                          {minivagasExtras.emFunil > 0 && (
                            <Badge variant="outline">
                              {minivagasExtras.emFunil} em entrevista
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <ClipboardList className="size-4 text-primary" />
                      Agenda de visitas
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {companySchedules.length} item(ns)
                    </span>
                  </div>

                  {companySchedules.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center space-y-1">
                      <Calendar className="size-6 mx-auto text-muted-foreground mb-2" />
                      <p className="font-medium text-sm">Nenhuma visita na agenda</p>
                      <p className="text-xs text-muted-foreground">
                        Quando houver visita agendada, ela aparece aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {companySchedules.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-4 space-y-2 ${
                            isUpcomingSchedule(item)
                              ? 'bg-amber-50/70 border-amber-200/70 dark:bg-amber-950/30 dark:border-amber-800/40'
                              : 'bg-card'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0">
                              <div className="flex gap-1.5 flex-wrap">
                                <Badge variant="warning">Visita</Badge>
                                <Badge variant="outline">{item.status}</Badge>
                              </div>
                              <h4 className="font-semibold text-sm leading-snug">{item.title}</h4>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatScheduleDate(item.startsAt)}
                            </span>
                          </div>
                          {item.responsibleName && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="size-3.5" />
                              {item.responsibleName}
                            </p>
                          )}
                          {(item.observations || item.description) &&
                            (item.observations || item.description) !== item.title && (
                              <div className="rounded-lg border border-amber-200/70 bg-amber-50/70 dark:border-amber-800/40 dark:bg-amber-950/30 p-2.5 space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200 flex items-center gap-1">
                                  <StickyNote className="size-3" />
                                  Observações da agenda
                                </p>
                                <p className="text-xs text-amber-950 dark:text-amber-50 leading-relaxed whitespace-pre-wrap">
                                  {item.observations || item.description}
                                </p>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoField({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <span className="text-xs text-muted-foreground block mb-0.5">{label}</span>
      <strong
        className={`break-words font-semibold ${emphasize ? 'text-primary text-base' : ''}`}
      >
        {value}
      </strong>
    </div>
  );
}
