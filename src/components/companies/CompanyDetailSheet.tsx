import { MapPin, Phone, Mail, User, ClipboardList, Calendar, ExternalLink, Navigation, StickyNote, ThumbsDown } from 'lucide-react';
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
            <SheetHeader className="p-5 sm:p-6 bg-gradient-to-br from-teal-800 to-cyan-900 dark:from-teal-950 dark:to-slate-900 text-white space-y-0 text-left shrink-0">
              <div className="flex items-start gap-3 sm:gap-4 pr-8 min-w-0">
                <div className="size-14 sm:size-16 rounded-2xl bg-white/10 border-2 border-white/20 shadow-md shrink-0 flex items-center justify-center">
                  <Calendar className="size-7 text-white/90" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge className="bg-white/15 text-teal-50 border-white/20 hover:bg-white/20">
                      {company.neighborhoodName}
                    </Badge>
                    <StatusBadge status={company.status} />
                  </div>
                  <SheetTitle className="text-white text-base sm:text-lg break-words">
                    {getCompanyDisplayName(company)}
                  </SheetTitle>
                  <SheetDescription className="text-teal-100/80 break-words">
                    {company.tradeName ? `Razão social: ${company.name}` : company.category}
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
                <a
                  href={googleMapsCompanyUrl(company)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation />
                  Google Maps
                  <ExternalLink className="size-3 opacity-70" />
                </a>
              </Button>
            </div>

            <ScrollArea className="flex-1 min-h-0 min-w-0">
              <div className="p-4 sm:p-6 space-y-6 w-full max-w-full overflow-x-hidden">
                <div className="rounded-xl border bg-muted/30 p-4 space-y-3 min-w-0">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dados do convênio
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm min-w-0">
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground block">Categoria</span>
                      <strong className="break-words">{company.category}</strong>
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground block">CNPJ</span>
                      <strong className="break-all">{company.cnpj || 'Não informado'}</strong>
                    </div>
                    <div className="sm:col-span-2 min-w-0">
                      <span className="text-xs text-muted-foreground block">Endereço</span>
                      <strong className="flex items-start gap-1.5 mt-0.5 break-words">
                        <MapPin className="size-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="min-w-0 break-words">{company.address}</span>
                      </strong>
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground block">Contato</span>
                      <strong className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        <User className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="break-words">
                          {company.contactPerson}
                          {company.contactRole ? ` (${company.contactRole})` : ''}
                        </span>
                      </strong>
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground block">Telefone / e-mail</span>
                      <div className="space-y-0.5 mt-0.5 min-w-0">
                        <p className="flex items-center gap-1.5 text-sm min-w-0">
                          <Phone className="size-3 text-muted-foreground shrink-0" />
                          <span className="break-all">{company.phone}</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-sm min-w-0">
                          <Mail className="size-3 text-muted-foreground shrink-0" />
                          <span className="break-all">{company.email}</span>
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Início do convênio</span>
                      <strong>{company.convenioDate}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Visitas na agenda</span>
                      <strong className="text-primary text-base">{companySchedules.length}</strong>
                    </div>
                  </div>
                  {company.description && (
                    <>
                      <Separator />
                      <p className="text-sm text-muted-foreground italic">"{company.description}"</p>
                    </>
                  )}
                </div>

                {(minivagasExtras?.observacoes ||
                  (minivagasExtras &&
                    (minivagasExtras.reprovados > 0 ||
                      minivagasExtras.contratados > 0 ||
                      minivagasExtras.enviados > 0 ||
                      minivagasExtras.reprovadosMes > 0 ||
                      minivagasExtras.contratadosMes > 0))) && (
                  <div className="space-y-3">
                    {minivagasExtras.reputation &&
                      minivagasExtras.reputation.enviados > 0 && (
                        <CompanyReputationCard reputation={minivagasExtras.reputation} />
                      )}

                    <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/30 p-4 space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-900/80 dark:text-amber-100/80 flex items-center gap-2">
                        <StickyNote className="size-3.5" />
                        Minivagas
                      </h3>
                      {minivagasExtras.observacoes && (
                        <p className="text-sm text-amber-950 dark:text-amber-50 leading-relaxed break-words whitespace-pre-wrap">
                          {minivagasExtras.observacoes}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-card">
                          {minivagasExtras.enviados} enviado(s)
                        </Badge>
                        <Badge
                          variant="outline"
                          className="bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-100 dark:border-sky-800"
                        >
                          {minivagasExtras.contratados} contrat. (geral)
                        </Badge>
                        <Badge
                          variant="outline"
                          className="bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:border-rose-800"
                        >
                          <ThumbsDown className="size-3" />
                          {minivagasExtras.reprovados} reprov. (geral)
                        </Badge>
                        {minivagasExtras.emFunil > 0 && (
                          <Badge variant="outline">{minivagasExtras.emFunil} no funil</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-sky-800 border-sky-200/80">
                          {minivagasExtras.contratadosMes} contrat. este mês
                        </Badge>
                        <Badge variant="outline" className="text-rose-800 border-rose-200/80">
                          {minivagasExtras.reprovadosMes} reprov. este mês
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
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
                      <p className="font-medium text-sm">Nenhuma visita na agenda</p>
                      <p className="text-xs text-muted-foreground">
                        Agendamentos vêm do Estagius (título com o nome fantasia).
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {companySchedules.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-4 space-y-2 ${
                            isUpcomingSchedule(item)
                              ? 'bg-amber-50/70 border-amber-200/70'
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
                          {item.description && (
                            <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg">
                              {item.description}
                            </p>
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
