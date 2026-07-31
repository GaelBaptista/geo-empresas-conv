import { useMemo } from 'react';
import { Clock, ExternalLink, MapPinned, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCompanyDisplayName } from '@/lib/company';
import {
  formatScheduleDate,
  getVisitSchedulesInWindow,
  googleMapsCompanyUrl,
  orderDayRouteByProximity,
} from '@/lib/schedule-match';
import { formatDistanceKm, type LatLng, type LocationSource } from '@/lib/user-location';
import type { Company, ScheduleItem } from '@/types';

interface DayRoutePanelProps {
  schedules: ScheduleItem[];
  companies: Company[];
  userLocation?: LatLng | null;
  locationSource?: LocationSource;
  onFocusCompany: (company: Company) => void;
}

export function DayRoutePanel({
  schedules,
  companies,
  userLocation = null,
  locationSource = 'fortaleza',
  onFocusCompany,
}: DayRoutePanelProps) {
  const todayVisits = useMemo(() => getVisitSchedulesInWindow(schedules, 'today'), [schedules]);

  const route = useMemo(
    () => orderDayRouteByProximity(todayVisits, companies, userLocation),
    [todayVisits, companies, userLocation]
  );

  const sortHint =
    locationSource === 'gps'
      ? 'Ordenado pela proximidade a partir da sua cidade'
      : 'Partindo de Fortaleza · ordenado por proximidade';

  if (todayVisits.length === 0) {
    return (
      <Card className="shadow-xl border-border/80 bg-card/95 backdrop-blur-md">
        <CardHeader className="p-3.5 pb-2 pr-10">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Route className="size-4 text-primary shrink-0" />
            Rota do dia
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 pt-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Nenhuma visita agendada para hoje.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl border-border/80 bg-card/95 backdrop-blur-md max-h-[min(58vh,460px)] flex flex-col overflow-hidden min-h-0">
      <CardHeader className="p-3.5 pb-3 shrink-0 border-b border-border/60">
        <div className="pr-8 space-y-1">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Route className="size-4 text-primary shrink-0" />
            <span className="truncate">Rota do dia</span>
            <Badge variant="secondary" className="tabular-nums shrink-0">
              {todayVisits.length}
            </Badge>
          </CardTitle>
          <p className="text-[11px] text-muted-foreground leading-snug pl-6">
            {sortHint}
            {route.length < todayVisits.length
              ? ` · ${todayVisits.length - route.length} sem pin`
              : ''}
          </p>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-3 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2">
        {route.map((stop, index) => {
          const distance =
            stop.kmFromPrev > 0
              ? `${index === 0 && userLocation ? '' : '+'}${formatDistanceKm(stop.kmFromPrev)}`
              : null;

          return (
            <div
              key={stop.schedule.id}
              className="rounded-xl border border-border/80 bg-background px-3 py-2.5 space-y-2.5 shadow-sm"
            >
              <div className="flex items-start gap-2.5">
                <span className="size-6 rounded-full bg-primary/12 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-xs font-semibold leading-snug line-clamp-2">
                    {getCompanyDisplayName(stop.company)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      <Clock className="size-2.5" />
                      {formatScheduleDate(stop.schedule.startsAt)}
                    </span>
                    {distance ? (
                      <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {distance}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={() => onFocusCompany(stop.company)}
                >
                  <MapPinned className="size-3.5" />
                  Pin
                </Button>
                <Button variant="secondary" size="sm" className="h-8 text-[11px]" asChild>
                  <a
                    href={googleMapsCompanyUrl(stop.company, userLocation)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="size-3.5" />
                    Google Maps
                  </a>
                </Button>
              </div>
            </div>
          );
        })}

        {todayVisits
          .filter((s) => !route.some((r) => r.schedule.id === s.id))
          .map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-dashed border-border/80 px-3 py-2.5 text-[11px] text-muted-foreground leading-snug"
            >
              Sem pin no mapa:{' '}
              <span className="font-medium text-foreground/80">
                {item.matchedCompanyName || item.apiCompanyName || item.title}
              </span>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
