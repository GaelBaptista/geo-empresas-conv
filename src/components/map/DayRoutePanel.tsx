import { useMemo } from 'react';
import { ExternalLink, MapPinned, Navigation, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCompanyDisplayName } from '@/lib/company';
import {
  formatScheduleDate,
  getVisitSchedulesInWindow,
  googleMapsCompanyUrl,
  googleMapsRouteUrl,
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

  const mapsUrl = useMemo(() => {
    if (route.length === 0) return null;
    return googleMapsRouteUrl(
      route.map((r) => r.company.address),
      userLocation
    );
  }, [route, userLocation]);

  if (todayVisits.length === 0) {
    return (
      <Card className="shadow-xl border-border/80 bg-card/95 backdrop-blur-md">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Route className="size-4 text-primary" />
            Rota do dia
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <p className="text-xs text-muted-foreground">Nenhuma visita agendada para hoje.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl border-border/80 bg-card/95 backdrop-blur-md max-h-[min(55vh,420px)] flex flex-col overflow-hidden min-h-0">
      <CardHeader className="p-3 pb-2 shrink-0 space-y-2">
        <div className="flex items-start justify-between gap-2 pr-8">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Route className="size-4 text-primary" />
            Rota do dia
            <Badge variant="secondary">{todayVisits.length}</Badge>
          </CardTitle>
          {mapsUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={mapsUrl} target="_blank" rel="noreferrer">
                <Navigation />
                Google Maps
                <ExternalLink className="size-3 opacity-70" />
              </a>
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {locationSource === 'gps'
            ? 'Ordenado a partir da sua cidade · proximidade'
            : 'Partindo de Fortaleza (padrão) · ordenado por proximidade'}
          {route.length < todayVisits.length
            ? ` · ${todayVisits.length - route.length} sem pin no mapa`
            : ''}
          {todayVisits.length > 3 ? ' · role a lista' : ''}
        </p>
      </CardHeader>
      <CardContent className="p-3 pt-0 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2">
        {route.map((stop, index) => (
          <div
            key={stop.schedule.id}
            className="rounded-lg border bg-muted/40 px-2.5 py-2 space-y-1.5"
          >
            <div className="flex items-start gap-2">
              <span className="size-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">
                  {getCompanyDisplayName(stop.company)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatScheduleDate(stop.schedule.startsAt)}
                  {stop.kmFromPrev > 0
                    ? ` · ${index === 0 && userLocation ? 'a ' : '+'}${formatDistanceKm(stop.kmFromPrev)}`
                    : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pl-7">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] px-2"
                onClick={() => onFocusCompany(stop.company)}
              >
                <MapPinned className="size-3" />
                Pin
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" asChild>
                <a
                  href={googleMapsCompanyUrl(stop.company, userLocation)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="size-3" />
                  Ir
                </a>
              </Button>
            </div>
          </div>
        ))}

        {todayVisits
          .filter((s) => !route.some((r) => r.schedule.id === s.id))
          .map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-dashed px-2.5 py-2 text-[11px] text-muted-foreground"
            >
              Sem pin: {item.matchedCompanyName || item.apiCompanyName || item.title}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
