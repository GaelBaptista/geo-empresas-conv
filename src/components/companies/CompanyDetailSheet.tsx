import { useEffect, useMemo, useState } from 'react';
import { MapPin, Phone, Mail, StickyNote, ThumbsDown, Building2, FileDown, CheckCircle2, AlertCircle, Loader2, ExternalLink, Navigation } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/companies/StatusBadge';
import { CompanyReputationCard } from '@/components/companies/CompanyReputationCard';
import { CompanyVisitHistory } from '@/components/companies/CompanyVisitHistory';
import { getCompanyDisplayName } from '@/lib/company';
import { exportCompanyDetailPdf } from '@/lib/company-pdf';
import { googleMapsCompanyUrl } from '@/lib/schedule-match';
import type { CompanyDrvagasExtras } from '@/services/drvagasApi';
import type { Company, ScheduleItem } from '@/types';

interface CompanyDetailSheetProps {
  company: Company | null;
  schedules: ScheduleItem[];
  drvagasExtras?: CompanyDrvagasExtras | null;
  onClose: () => void;
  onFocusOnMap: (company: Company) => void;
}

export function CompanyDetailSheet({
  company,
  schedules,
  drvagasExtras = null,
  onClose,
  onFocusOnMap,
}: CompanyDetailSheetProps) {
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle'
  );

  useEffect(() => {
    setExportStatus('idle');
  }, [company?.id]);

  useEffect(() => {
    if (exportStatus !== 'success' && exportStatus !== 'error') return;
    const t = window.setTimeout(() => setExportStatus('idle'), 4500);
    return () => window.clearTimeout(t);
  }, [exportStatus]);

  const visitCount = useMemo(() => {
    if (!company) return 0;
    return schedules.filter((s) => s.isVisit && s.matchedCompanyId === company.id).length;
  }, [company, schedules]);

  const handleExportPdf = async () => {
    if (!company || exportStatus === 'loading') return;
    setExportStatus('loading');
    try {
      await exportCompanyDetailPdf(company, drvagasExtras);
      setExportStatus('success');
    } catch {
      setExportStatus('error');
    }
  };

  return (
    <Sheet open={!!company} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="p-0 flex flex-col gap-0 overflow-hidden w-full sm:max-w-xl md:max-w-2xl max-w-[100vw]">
        {company && (
          <>
            <SheetHeader className="p-5 sm:p-6 bg-gradient-to-br from-primary to-teal-800 dark:from-teal-950 dark:to-cyan-950 text-primary-foreground space-y-0 text-left shrink-0">
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

            <div className="p-4 bg-muted/50 border-b space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[8rem]"
                  onClick={() => {
                    onFocusOnMap(company);
                    onClose();
                  }}
                >
                  <MapPin />
                  Ver no mapa
                </Button>
                <Button variant="outline" size="sm" className="flex-1 min-w-[8rem]" asChild>
                  <a href={googleMapsCompanyUrl(company)} target="_blank" rel="noreferrer">
                    <Navigation />
                    Google Maps
                    <ExternalLink className="size-3 opacity-70" />
                  </a>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 min-w-[8rem]"
                  disabled={exportStatus === 'loading'}
                  onClick={() => void handleExportPdf()}
                >
                  {exportStatus === 'loading' ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <FileDown />
                  )}
                  {exportStatus === 'loading' ? 'Gerando…' : 'Exportar PDF'}
                </Button>
              </div>

              {exportStatus === 'success' && (
                <Alert variant="success">
                  <CheckCircle2 />
                  <AlertTitle>PDF exportado</AlertTitle>
                  <AlertDescription>
                    O download da ficha foi iniciado com sucesso.
                  </AlertDescription>
                </Alert>
              )}

              {exportStatus === 'error' && (
                <Alert variant="warning">
                  <AlertCircle />
                  <AlertTitle>Falha na exportação</AlertTitle>
                  <AlertDescription>
                    Não foi possível gerar o PDF. Tente novamente em instantes.
                  </AlertDescription>
                </Alert>
              )}
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
                        value={String(visitCount)}
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
                    {(company.activeTrainees != null ||
                      company.inactiveTrainees != null ||
                      company.amountClt != null ||
                      company.internQuota != null) && (
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
                          <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/40 px-3 py-2.5">
                            <p className="text-[11px] text-sky-800/80 dark:text-sky-200/80">
                              Funcionários CLT
                            </p>
                            <p className="text-lg font-bold tabular-nums text-sky-800 dark:text-sky-100">
                              {company.amountClt != null
                                ? company.amountClt.toLocaleString('pt-BR')
                                : '—'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-800/40 px-3 py-2.5">
                            <p className="text-[11px] text-violet-800/80 dark:text-violet-200/80">
                              Cota de estagiários
                            </p>
                            <p className="text-lg font-bold tabular-nums text-violet-800 dark:text-violet-100">
                              {company.internQuota != null
                                ? company.internQuota.toLocaleString('pt-BR')
                                : '—'}
                            </p>
                            {company.amountClt != null && company.amountClt >= 26 ? (
                              <p className="text-[10px] text-violet-700/70 dark:text-violet-300/70 mt-0.5">
                                20% do CLT
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {(drvagasExtras?.observacoes ||
                  (drvagasExtras &&
                    (drvagasExtras.reprovados > 0 ||
                      drvagasExtras.contratados > 0 ||
                      drvagasExtras.naoCompareceu > 0 ||
                      drvagasExtras.enviados > 0 ||
                      drvagasExtras.reprovadosMes > 0 ||
                      drvagasExtras.contratadosMes > 0 ||
                      drvagasExtras.naoCompareceuMes > 0 ||
                      (drvagasExtras.recruiters?.length ?? 0) > 0))) && (
                  <div className="space-y-3">
                    {(drvagasExtras.recruiters?.length ?? 0) > 0 && (
                      <Card className="border-teal-300/80 bg-teal-50/90 shadow-none dark:border-teal-700/70 dark:bg-teal-950/40">
                        <CardContent className="py-3.5 px-4">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800/80 dark:text-teal-200/80">
                            Recrutador
                          </p>
                          <p className="text-base font-bold text-teal-950 dark:text-teal-50 mt-1">
                            {drvagasExtras.recruiters!.join(' · ')}
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {drvagasExtras.reputation &&
                      drvagasExtras.reputation.score != null && (
                        <CompanyReputationCard
                          reputation={drvagasExtras.reputation}
                          recruiters={drvagasExtras.recruiters}
                        />
                      )}

                    <Card className="border-border/80 bg-muted/40 dark:bg-muted/25 shadow-none">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                          <StickyNote className="size-3.5 text-primary" />
                          Observações DrVagas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {drvagasExtras.observacoes && (
                          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                            {drvagasExtras.observacoes}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="bg-background">
                            {drvagasExtras.enviados} candidato(s)
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-100 dark:border-sky-800"
                          >
                            {drvagasExtras.contratados} contratados
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:border-rose-800"
                          >
                            <ThumbsDown className="size-3" />
                            {drvagasExtras.reprovados} reprovados
                          </Badge>
                          {drvagasExtras.naoCompareceu > 0 && (
                            <Badge
                              variant="outline"
                            className="bg-orange-50 text-orange-900 border-orange-200 dark:bg-orange-950/40 dark:text-orange-100 dark:border-orange-800"
                            >
                              {drvagasExtras.naoCompareceu} faltas
                            </Badge>
                          )}
                          {drvagasExtras.emFunil > 0 && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-800"
                            >
                              {drvagasExtras.emFunil} em entrevista
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <CompanyVisitHistory schedules={schedules} companyId={company.id} />
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
