import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Users, UserX, Filter, X, Search, LocateFixed, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DayRoutePanel } from '@/components/map/DayRoutePanel';
import {
  cityCenter,
  DEFAULT_MAP_CITY,
  filterByCity,
  filterByGroup,
  filterByInterns,
  getCompanyDisplayName,
  listCities,
  normalizeCity,
  pickDefaultCity,
  type InternFilter,
} from '@/lib/company';
import { normalizeMatchText, formatScheduleDate, googleMapsCompanyUrl } from '@/lib/schedule-match';
import { spreadOverlappingCompanies } from '@/lib/map-spread';
import {
  companyDistanceKm,
  formatDistanceKm,
  resolveMapCityForLocation,
  type LatLng,
  type LocationSource,
} from '@/lib/user-location';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import type { Company, Neighborhood, ScheduleItem } from '@/types';
import type { GroupOption } from '@/services/groupsApi';
import type { FocusMapRequest } from '@/hooks/useAppData';

interface MapViewProps {
  companies: Company[];
  neighborhoods: Neighborhood[];
  groups?: GroupOption[];
  schedules: ScheduleItem[];
  selectedNeighborhoodId: string;
  focusMapRequest?: FocusMapRequest | null;
  onFocusConsumed?: () => void;
  companiesWithVisitIds?: Set<string>;
  getNextVisitForCompany?: (companyId: string) => ScheduleItem | null;
  onSelectCompany: (company: Company) => void;
  onSelectNeighborhood: (id: string) => void;
  onFocusCompany: (company: Company) => void;
  userLocation?: LatLng | null;
  locationSource?: LocationSource;
  locationReady?: boolean;
  locationRequesting?: boolean;
  locationError?: string | null;
  onRequestLocation?: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function MapView({
  companies,
  neighborhoods,
  groups = [],
  schedules,
  selectedNeighborhoodId,
  focusMapRequest,
  onFocusConsumed,
  companiesWithVisitIds,
  getNextVisitForCompany,
  onSelectCompany,
  onSelectNeighborhood,
  onFocusCompany,
  userLocation = null,
  locationSource = 'fortaleza',
  locationReady = false,
  locationRequesting = false,
  locationError = null,
  onRequestLocation,
}: MapViewProps) {
  const { theme } = useTheme();
  const requestLocation = onRequestLocation ?? (() => {});
  const usingGps = locationSource === 'gps' && locationReady;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const userMarkerRef = useRef<L.Marker | null>(null);
  const handlersRef = useRef({ onSelectCompany });
  handlersRef.current = { onSelectCompany };
  const skipNeighborhoodFlyRef = useRef(false);
  const didAutoCityFromGpsRef = useRef(false);

  const [internFilter, setInternFilter] = useState<InternFilter>('with_active');
  const [selectedGroupId, setSelectedGroupId] = useState<number | 'ALL'>('ALL');
  const [nameQuery, setNameQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [routeOpen, setRouteOpen] = useState(true);

  const filteredByGroup = useMemo(
    () => filterByGroup(companies, selectedGroupId),
    [companies, selectedGroupId]
  );

  const filteredByInterns = useMemo(
    () => filterByInterns(filteredByGroup, internFilter),
    [filteredByGroup, internFilter]
  );

  const filteredByName = useMemo(() => {
    const q = normalizeMatchText(nameQuery);
    if (!q) return filteredByInterns;
    return filteredByInterns.filter((company) => {
      const display = normalizeMatchText(getCompanyDisplayName(company));
      const legal = normalizeMatchText(company.name);
      const fantasy = normalizeMatchText(company.tradeName);
      return display.includes(q) || legal.includes(q) || fantasy.includes(q);
    });
  }, [filteredByInterns, nameQuery]);

  const cities = useMemo(() => listCities(filteredByName), [filteredByName]);
  const [selectedCity, setSelectedCity] = useState(DEFAULT_MAP_CITY);
  const didInitCityRef = useRef(false);

  useEffect(() => {
    if (cities.length === 0) return;

    if (!didInitCityRef.current) {
      didInitCityRef.current = true;
      setSelectedCity(pickDefaultCity(cities));
      return;
    }

    const stillExists = cities.some((c) => normalizeCity(c) === normalizeCity(selectedCity));
    if (!stillExists) {
      setSelectedCity(pickDefaultCity(cities));
      onSelectNeighborhood('ALL');
    }
  }, [cities, selectedCity, onSelectNeighborhood]);

  // Sync cidade/filtros ao focar empresa (Ver no mapa) — garante pin visível
  useEffect(() => {
    if (!focusMapRequest) return;
    const company = companies.find((c) => c.id === focusMapRequest.companyId);
    if (!company) return;
    const city = company.city || DEFAULT_MAP_CITY;
    if (normalizeCity(city) !== normalizeCity(selectedCity)) {
      setSelectedCity(city);
    }
    setNameQuery('');
    setInternFilter('all');
    setSelectedGroupId('ALL');
  }, [focusMapRequest, companies, selectedCity]);

  const companiesInCity = useMemo(
    () => filterByCity(filteredByName, selectedCity),
    [filteredByName, selectedCity]
  );

  const neighborhoodsInCity = useMemo(() => {
    const cityKey = normalizeCity(selectedCity);
    return neighborhoods
      .filter((n) => normalizeCity(n.city) === cityKey)
      .map((n) => ({
        ...n,
        count: companiesInCity.filter((c) => c.neighborhoodId === n.id).length,
      }))
      .filter((n) => n.count > 0);
  }, [neighborhoods, selectedCity, companiesInCity]);

  const visibleCompanies = useMemo(() => {
    if (selectedNeighborhoodId === 'ALL') return companiesInCity;
    return companiesInCity.filter((c) => c.neighborhoodId === selectedNeighborhoodId);
  }, [companiesInCity, selectedNeighborhoodId]);

  const withActiveInCity = filterByCity(filteredByGroup, selectedCity).filter(
    (c) => (c.activeTrainees ?? 0) > 0
  ).length;
  const withoutActiveInCity = filterByCity(filteredByGroup, selectedCity).filter(
    (c) => (c.activeTrainees ?? 0) === 0
  ).length;

  const groupOptions = useMemo(
    () => [
      {
        value: 'ALL',
        label: 'Todos os grupos',
        hint: String(companies.length),
      },
      ...groups.map((group) => ({
        value: String(group.id),
        label: group.label,
        hint: String(companies.filter((c) => c.groupId === group.id).length),
      })),
    ],
    [groups, companies]
  );

  const selectedGroupLabel =
    selectedGroupId === 'ALL'
      ? 'Todos os grupos'
      : groups.find((g) => g.id === selectedGroupId)?.label || 'Grupo';

  const cityOptions = useMemo(
    () =>
      cities.map((city) => ({
        value: city,
        label: city,
        hint: String(filterByCity(filteredByName, city).length),
      })),
    [cities, filteredByName]
  );

  const neighborhoodOptions = useMemo(
    () => [
      {
        value: 'ALL',
        label: 'Todos os bairros',
        hint: String(companiesInCity.length),
      },
      ...neighborhoodsInCity.map((n) => ({
        value: n.id,
        label: n.name,
        hint: String(n.count),
      })),
    ],
    [neighborhoodsInCity, companiesInCity.length]
  );

  const selectedNeighborhoodLabel =
    selectedNeighborhoodId === 'ALL'
      ? 'Todos os bairros'
      : neighborhoodsInCity.find((n) => n.id === selectedNeighborhoodId)?.name || 'Bairro';

  const internLabel =
    internFilter === 'with_active'
      ? 'Com estagiários'
      : internFilter === 'without_active'
        ? 'Sem estagiários'
        : 'Todas';

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-3.7327, -38.527],
      zoom: 13,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const url =
      theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const layer = L.tileLayer(url, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = layer;
  }, [theme]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (skipNeighborhoodFlyRef.current) {
      skipNeighborhoodFlyRef.current = false;
      return;
    }

    if (selectedNeighborhoodId && selectedNeighborhoodId !== 'ALL') {
      const neigh = neighborhoods.find((n) => n.id === selectedNeighborhoodId);
      if (neigh) {
        map.flyTo(neigh.center, 15, { duration: 1.2, easeLinearity: 0.25 });
        return;
      }
    }

    const center = cityCenter(companiesInCity);
    map.flyTo(center, companiesInCity.length > 0 ? 12.5 : 11, { duration: 1 });
  }, [selectedNeighborhoodId, neighborhoods, selectedCity, companiesInCity]);

  // Ao definir localização: seleciona a CIDADE e centraliza nela (não no ponto GPS exato)
  useEffect(() => {
    if (!userLocation || !locationReady) return;
    if (didAutoCityFromGpsRef.current) return;
    didAutoCityFromGpsRef.current = true;

    const city = resolveMapCityForLocation(filteredByName, userLocation, locationSource);
    if (normalizeCity(city) !== normalizeCity(selectedCity)) {
      setSelectedCity(city);
      onSelectNeighborhood('ALL');
    }
    // O flyTo da cidade acontece no effect de selectedCity / companiesInCity
  }, [userLocation, locationReady, locationSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marcador só quando GPS real (cidade padrão Fortaleza não precisa de pin “falso”)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!userLocation || !locationReady || !usingGps) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    const icon = L.divIcon({
      className: 'user-location-pin',
      html: `
        <div style="position:relative;width:22px;height:22px;">
          <span style="
            position:absolute;inset:-6px;border-radius:9999px;
            background:rgba(37,99,235,.22);
          "></span>
          <span style="
            position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
            width:14px;height:14px;border-radius:9999px;
            background:#2563eb;border:2.5px solid #fff;
            box-shadow:0 2px 8px rgba(37,99,235,.45);
          "></span>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const popupHtml =
      '<strong>Sua região</strong><br/><span style="font-size:11px;color:#64748b">Usado para escolher a cidade no mapa</span>';

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      userMarkerRef.current.setIcon(icon);
      userMarkerRef.current.setPopupContent(popupHtml);
      return;
    }

    userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
      icon,
      zIndexOffset: 1000,
    })
      .bindPopup(popupHtml)
      .addTo(map);
  }, [userLocation, locationReady, usingGps]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const positionedCompanies = spreadOverlappingCompanies(visibleCompanies);

    positionedCompanies.forEach((company) => {
      const displayName = getCompanyDisplayName(company);
      const shortLabel = displayName.split(/\s+/).slice(0, 4).join(' ');
      const hasActive = (company.activeTrainees ?? 0) > 0;
      const hasVisit = companiesWithVisitIds?.has(company.id) ?? false;
      const nextVisit = getNextVisitForCompany?.(company.id) || null;
      const distanceKm = userLocation
        ? companyDistanceKm(company, userLocation)
        : null;
      // VIS âmbar · com estagiário verde · sem estagiário vermelho
      const pinColor = hasVisit ? '#d97706' : hasActive ? '#10b981' : '#dc2626';
      const borderColor = pinColor;

      const iconHtml = `
        <div style="cursor:pointer;text-align:center;transform:translateY(-4px);">
          <div style="
            display:inline-flex;align-items:center;gap:5px;
            background:${hasVisit ? '#fffbeb' : hasActive ? '#fff' : '#fef2f2'};color:#0f172a;
            border:1.5px solid ${borderColor};
            border-radius:6px;padding:3px 8px;
            box-shadow:0 2px 8px rgba(15,23,42,.14);
            max-width:170px;
          ">
            <span style="
              width:7px;height:7px;border-radius:9999px;flex-shrink:0;
              background:${pinColor};
            "></span>
            <span style="
              font-size:11px;font-weight:650;line-height:1.15;
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            ">${escapeHtml(shortLabel)}</span>
            ${
              hasVisit
                ? `<span style="font-size:9px;font-weight:800;letter-spacing:.02em;color:#b45309;flex-shrink:0;background:#fde68a;border-radius:3px;padding:1px 3px;">VIS</span>`
                : ''
            }
          </div>
          <div style="
            width:8px;height:8px;background:${borderColor};
            transform:rotate(45deg);margin:-3px auto 0;
            border-right:1px solid ${borderColor};border-bottom:1px solid ${borderColor};
          "></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-company-pin',
        iconSize: [170, 36],
        iconAnchor: [85, 32],
        popupAnchor: [0, -28],
      });

      const marker = L.marker([company.mapLat, company.mapLng], { icon: customIcon }).addTo(map);
      const active = company.activeTrainees ?? 0;

      const popupDiv = document.createElement('div');
      popupDiv.style.minWidth = '250px';
      popupDiv.innerHTML = `
        <div style="padding-bottom:10px;border-bottom:1px solid #e2e8f0;">
          <span style="display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:#f1f5f9;color:#334155;margin-bottom:4px;">
            ${escapeHtml(company.city || selectedCity)} · ${escapeHtml(company.neighborhoodName)}
          </span>
          <h4 style="margin:0;font-size:13px;font-weight:700;color:#0f172a;line-height:1.2;">${escapeHtml(displayName)}</h4>
          ${
            company.tradeName
              ? `<p style="margin:2px 0 0;font-size:11px;color:#64748b;">Razão social: ${escapeHtml(company.name)}</p>`
              : ''
          }
          ${
            distanceKm != null && usingGps
              ? `<p style="margin:6px 0 0;font-size:12px;font-weight:700;color:#2563eb;">≈ ${escapeHtml(formatDistanceKm(distanceKm))} de você</p>`
              : distanceKm != null
                ? `<p style="margin:6px 0 0;font-size:12px;font-weight:700;color:#0f766e;">≈ ${escapeHtml(formatDistanceKm(distanceKm))} do centro de Fortaleza</p>`
                : ''
          }
        </div>
        <div style="padding:10px 0;font-size:12px;color:#475569;">
          <p style="margin:0 0 6px;"><strong>Estagiários ativos:</strong> ${active}</p>
          ${
            company.groupName
              ? `<p style="margin:0 0 6px;"><strong>Grupo:</strong> ${escapeHtml(company.groupName)}</p>`
              : ''
          }
          <p style="margin:0 0 4px;"><strong>Endereço:</strong> ${escapeHtml(company.address)}</p>
          <p style="margin:0 0 6px;"><strong>Contato:</strong> ${escapeHtml(company.contactPerson)} (${escapeHtml(company.phone)})</p>
          ${
            nextVisit
              ? `<div style="margin-top:8px;padding:8px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;">
                  <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#b45309;text-transform:uppercase;">Visita agendada</p>
                  <p style="margin:0;font-size:12px;color:#92400e;font-weight:600;">${escapeHtml(formatScheduleDate(nextVisit.startsAt))}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#78350f;">${escapeHtml(nextVisit.title)}</p>
                </div>`
              : ''
          }
        </div>
        <div style="display:flex;gap:8px;padding-top:8px;border-top:1px solid #e2e8f0;">
          <button id="btn-details-${company.id}" style="flex:1;background:#0f766e;color:#fff;border:0;border-radius:8px;padding:8px;font-size:12px;font-weight:600;cursor:pointer;">
            Ficha
          </button>
          <a id="btn-maps-${company.id}" href="${escapeHtml(googleMapsCompanyUrl(company, userLocation))}" target="_blank" rel="noreferrer" style="flex:1;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:12px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;">
            Maps
          </a>
        </div>
      `;

      marker.bindPopup(popupDiv);
      marker.on('popupopen', () => {
        const detailsBtn = document.getElementById(`btn-details-${company.id}`);
        if (detailsBtn) {
          detailsBtn.onclick = () => handlersRef.current.onSelectCompany(company);
        }
      });

      markersRef.current[company.id] = marker;
    });
  }, [
    visibleCompanies,
    selectedCity,
    companiesWithVisitIds,
    getNextVisitForCompany,
    userLocation,
    usingGps,
  ]);

  // Ver no mapa: voa até o pin e abre popup
  useEffect(() => {
    if (!focusMapRequest) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    const company = companies.find((c) => c.id === focusMapRequest.companyId);
    if (!company) return;

    skipNeighborhoodFlyRef.current = true;

    const tryFocus = () => {
      const marker = markersRef.current[company.id];
      const lat = company.mapLat ?? company.lat;
      const lng = company.mapLng ?? company.lng;

      map.flyTo([lat, lng], 17, { duration: 1.1, easeLinearity: 0.25 });

      const openPopup = () => {
        const m = markersRef.current[company.id];
        if (m) {
          m.openPopup();
          onFocusConsumed?.();
          return true;
        }
        return false;
      };

      if (marker) {
        map.once('moveend', () => {
          openPopup();
        });
        // fallback se já estiver no zoom
        window.setTimeout(() => openPopup(), 1200);
      } else {
        // marcador ainda não renderizado (filtro/cidade) — tenta de novo
        window.setTimeout(() => {
          if (!openPopup()) onFocusConsumed?.();
        }, 400);
      }
    };

    const t = window.setTimeout(tryFocus, 80);
    return () => window.clearTimeout(t);
  }, [focusMapRequest, companies, visibleCompanies, onFocusConsumed]);

  return (
    <div className="relative w-full h-[calc(100vh-8.5rem)] min-h-[480px] rounded-2xl overflow-hidden border border-border/80 bg-muted shadow-inner shadow-black/5 dark:shadow-black/40">
      <div className="absolute top-3 left-3 right-3 sm:right-auto z-[1000] w-auto sm:w-[340px] max-w-[calc(100%-1.5rem)]">
        {!filtersOpen ? (
          <Button className="shadow-lg" onClick={() => setFiltersOpen(true)}>
            <Filter />
            Filtros
            <Badge variant="secondary" className="ml-1">
              {visibleCompanies.length}
            </Badge>
          </Button>
        ) : (
          <Card className="shadow-xl border-border/70 bg-card/95 backdrop-blur-xl overflow-visible">
            <CardHeader className="p-4 pb-3 flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Filter className="size-4 text-primary" />
                  Filtros do mapa
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {nameQuery.trim() ? `“${nameQuery.trim()}” · ` : ''}
                  {internLabel} · {selectedGroupLabel} · {selectedCity} · {selectedNeighborhoodLabel}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => setFiltersOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </CardHeader>

            <CardContent className="p-4 pt-0 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Sua localização</Label>
                <Button
                  type="button"
                  variant={usingGps ? 'secondary' : 'default'}
                  className="w-full justify-start"
                  disabled={locationRequesting}
                  onClick={() => {
                    didAutoCityFromGpsRef.current = false;
                    requestLocation();
                  }}
                >
                  {locationRequesting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LocateFixed className="size-4" />
                  )}
                  {usingGps ? 'Atualizar cidade' : 'Detectar minha cidade'}
                </Button>
                {usingGps ? (
                  <p className="text-[11px] text-sky-700 dark:text-sky-300">
                    Cidade detectada pela sua região · você pode trocar o filtro acima
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Cidade padrão: Fortaleza · toque para detectar a sua
                  </p>
                )}
                {locationError && !usingGps && (
                  <p className="text-[11px] text-muted-foreground">{locationError}</p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Buscar empresa</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    className="pl-9 pr-9"
                    placeholder="Digite o nome fantasia ou razão social..."
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                  />
                  {nameQuery && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => setNameQuery('')}
                      aria-label="Limpar busca"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Estagiários</Label>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                  {(
                    [
                      { id: 'with_active', label: 'Com', icon: Users },
                      { id: 'without_active', label: 'Sem', icon: UserX },
                      { id: 'all', label: 'Todas', icon: Filter },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = internFilter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setInternFilter(item.id);
                          onSelectNeighborhood('ALL');
                        }}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] font-semibold transition cursor-pointer',
                          active
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Icon className="size-3.5" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Grupo</Label>
                <SearchableSelect
                  value={selectedGroupId === 'ALL' ? 'ALL' : String(selectedGroupId)}
                  options={groupOptions}
                  placeholder="Escolher grupo"
                  searchPlaceholder="Buscar grupo..."
                  onChange={(value) => {
                    setSelectedGroupId(value === 'ALL' ? 'ALL' : Number(value));
                    onSelectNeighborhood('ALL');
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Cidade</Label>
                <SearchableSelect
                  value={selectedCity}
                  options={cityOptions}
                  placeholder="Escolher cidade"
                  searchPlaceholder="Buscar cidade..."
                  onChange={(city) => {
                    setSelectedCity(city);
                    onSelectNeighborhood('ALL');
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Bairro</Label>
                <SearchableSelect
                  value={selectedNeighborhoodId}
                  options={neighborhoodOptions}
                  placeholder="Escolher bairro"
                  searchPlaceholder="Buscar bairro..."
                  onChange={onSelectNeighborhood}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/60 px-2 py-2">
                  <p className="text-base font-bold text-foreground leading-none">
                    {visibleCompanies.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">no mapa</p>
                </div>
                <div className="rounded-lg bg-emerald-50 px-2 py-2">
                  <p className="text-base font-bold text-emerald-700 leading-none">
                    {withActiveInCity}
                  </p>
                  <p className="text-[10px] text-emerald-700/80 mt-1">com ativos</p>
                </div>
                <div className="rounded-lg bg-slate-100 px-2 py-2">
                  <p className="text-base font-bold text-slate-700 leading-none">
                    {withoutActiveInCity}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1">sem ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="absolute top-3 right-3 z-[1000] w-[min(100%-1.5rem,300px)] hidden sm:block max-h-[calc(100%-1.5rem)]">
        {routeOpen ? (
          <div className="relative max-h-full flex flex-col min-h-0">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 size-7 bg-card/80"
              onClick={() => setRouteOpen(false)}
            >
              <X className="size-3.5" />
            </Button>
            <DayRoutePanel
              schedules={schedules}
              companies={companies}
              userLocation={userLocation}
              locationSource={locationSource}
              onFocusCompany={onFocusCompany}
            />
          </div>
        ) : (
          <Button className="shadow-lg ml-auto flex" onClick={() => setRouteOpen(true)}>
            Rota do dia
          </Button>
        )}
      </div>

      <div ref={mapContainerRef} className="w-full h-full z-10" />

      <div className="absolute bottom-4 left-3 z-[1000] flex items-center gap-2 max-w-[calc(100%-1.5rem)] flex-wrap">
        <Button
          size="sm"
          variant={usingGps ? 'secondary' : 'default'}
          className="shadow-md"
          disabled={locationRequesting}
          onClick={() => {
            didAutoCityFromGpsRef.current = false;
            requestLocation();
          }}
        >
          {locationRequesting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <LocateFixed className="size-3.5" />
          )}
          {usingGps ? 'Cidade detectada' : 'Detectar cidade'}
        </Button>
        <Badge
          variant="secondary"
          className="shadow-md bg-card/95 backdrop-blur border px-3 py-1.5 truncate"
        >
          <MapPin className="size-3.5 text-primary mr-1 shrink-0" />
          {selectedCity}
          {selectedNeighborhoodId !== 'ALL' ? ` · ${selectedNeighborhoodLabel}` : ''}
        </Badge>
      </div>
    </div>
  );
}
