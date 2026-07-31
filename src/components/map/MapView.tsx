import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Users, UserX, Filter, X, Search, LocateFixed, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DayRoutePanel } from '@/components/map/DayRoutePanel';
import {
  cityCenter,
  DEFAULT_MAP_CITY,
  filterByCity,
  filterByGroup,
  filterByInterns,
  filterByState,
  getCompanyDisplayName,
  listCities,
  listStates,
  normalizeCity,
  pickDefaultCity,
  type InternFilter,
} from '@/lib/company';
import { normalizeMatchText, formatScheduleDate, googleMapsCompanyUrl } from '@/lib/schedule-match';
import { spreadOverlappingCompanies } from '@/lib/map-spread';
import {
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
  /** Quando false, o mapa fica oculto mas montado (evita remount caro). */
  isActive?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type PinKind = 'visit' | 'active' | 'inactive';

function pinKind(hasVisit: boolean, hasActive: boolean): PinKind {
  if (hasVisit) return 'visit';
  if (hasActive) return 'active';
  return 'inactive';
}

const PIN_COLORS: Record<PinKind, { pin: string; soft: string; labelBg: string }> = {
  visit: { pin: '#d97706', soft: '#fffbeb', labelBg: '#fffbeb' },
  active: { pin: '#059669', soft: '#ecfdf5', labelBg: '#ffffff' },
  inactive: { pin: '#dc2626', soft: '#fef2f2', labelBg: '#fef2f2' },
};

/** Reusa DivIcons iguais (mesmo estado + label) em vez de recriar HTML a cada sync. */
const pinIconCache = new Map<string, L.DivIcon>();

function getCompanyPinIcon(kind: PinKind, shortLabel: string): L.DivIcon {
  const cacheKey = `${kind}|${shortLabel}`;
  const cached = pinIconCache.get(cacheKey);
  if (cached) return cached;

  const { pin: pinColor, soft, labelBg } = PIN_COLORS[kind];
  const icon = L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;width:132px;">
        <div style="position:relative;width:24px;height:32px;flex-shrink:0;">
          <svg width="24" height="32" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(15,23,42,.25));">
            <path d="M17 0C7.611 0 0 7.5 0 16.75C0 28.5 17 42 17 42S34 28.5 34 16.75C34 7.5 26.389 0 17 0Z" fill="${pinColor}"/>
            <circle cx="17" cy="16" r="7.5" fill="${soft}"/>
            <circle cx="17" cy="16" r="3.5" fill="${pinColor}"/>
          </svg>
          ${
            kind === 'visit'
              ? `<span style="position:absolute;top:-4px;right:-9px;font-size:7px;font-weight:800;letter-spacing:.02em;color:#92400e;background:#fde68a;border:1px solid #f59e0b;border-radius:999px;padding:1px 3px;">VIS</span>`
              : ''
          }
        </div>
        <div style="
          margin-top:1px;max-width:128px;
          display:inline-flex;align-items:center;
          background:${labelBg};color:#0f172a;
          border:1.5px solid ${pinColor};
          border-radius:7px;padding:2px 6px;
          box-shadow:0 1px 6px rgba(15,23,42,.12);
        ">
          <span style="font-size:10px;font-weight:700;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(shortLabel)}</span>
        </div>
      </div>
    `,
    className: 'custom-company-pin',
    iconSize: [132, 52],
    iconAnchor: [66, 32],
    popupAnchor: [0, -30],
  });

  if (pinIconCache.size > 800) pinIconCache.clear();
  pinIconCache.set(cacheKey, icon);
  return icon;
}

function shortCompanyLabel(displayName: string): string {
  return displayName.split(/\s+/).slice(0, 4).join(' ');
}

function buildCompanyPopupHtml(
  company: Company,
  selectedCity: string,
  nextVisit: ScheduleItem | null,
  mapsUrl: string
): string {
  const displayName = getCompanyDisplayName(company);
  const active = company.activeTrainees ?? 0;
  const visitObs = (nextVisit?.observations || nextVisit?.description || '').trim();

  return `
    <div style="min-width:250px">
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
      </div>
      <div style="padding:10px 0;font-size:12px;color:#475569;">
        <p style="margin:0 0 6px;"><strong>Estagiários ativos:</strong> ${active}</p>
        ${
          company.groupName
            ? `<p style="margin:0 0 6px;"><strong>Grupo:</strong> ${escapeHtml(company.groupName)}</p>`
            : ''
        }
        <p style="margin:0 0 4px;"><strong>Endereço:</strong> ${escapeHtml(company.address)}</p>
        ${
          company.phone && company.phone !== '—'
            ? `<p style="margin:0 0 6px;"><strong>Telefone:</strong> ${escapeHtml(company.phone)}</p>`
            : ''
        }
        ${
          nextVisit
            ? `<div style="margin-top:8px;padding:8px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;">
                <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#b45309;text-transform:uppercase;">Visita agendada</p>
                <p style="margin:0;font-size:12px;color:#92400e;font-weight:600;">${escapeHtml(formatScheduleDate(nextVisit.startsAt))}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#78350f;">${escapeHtml(nextVisit.title)}</p>
                ${
                  visitObs
                    ? `<p style="margin:6px 0 0;font-size:11px;color:#78350f;line-height:1.35;"><strong>Observações:</strong> ${escapeHtml(visitObs)}</p>`
                    : ''
                }
              </div>`
            : ''
        }
      </div>
      <div style="display:flex;gap:8px;padding-top:8px;border-top:1px solid #e2e8f0;">
        <button type="button" data-action="details" style="flex:1;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;padding:8px;font-size:12px;font-weight:600;cursor:pointer;">
          Detalhes
        </button>
        <a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer" style="flex:1;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;padding:8px;font-size:12px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;">
          Google Maps
        </a>
      </div>
      <p style="margin:8px 0 0;font-size:10px;line-height:1.35;color:#64748b;">
        O pin no mapa é aproximado. Use o Google Maps para a localização exata pelo endereço.
      </p>
    </div>
  `;
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
  isActive = true,
}: MapViewProps) {
  const { theme } = useTheme();
  const requestLocation = onRequestLocation ?? (() => {});
  const usingGps = locationSource === 'gps' && locationReady;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const markerSignatureRef = useRef<Record<string, string>>({});
  const markerSyncGenRef = useRef(0);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const handlersRef = useRef({ onSelectCompany });
  handlersRef.current = { onSelectCompany };
  const skipNeighborhoodFlyRef = useRef(false);
  const didAutoCityFromGpsRef = useRef(false);
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;
  const selectedCityRef = useRef(DEFAULT_MAP_CITY);
  const getNextVisitRef = useRef(getNextVisitForCompany);
  getNextVisitRef.current = getNextVisitForCompany;
  const companiesByIdRef = useRef<Map<string, Company>>(new Map());

  const [internFilter, setInternFilter] = useState<InternFilter>('with_active');
  const [selectedGroupId, setSelectedGroupId] = useState<number | 'ALL'>('ALL');
  const [selectedState, setSelectedState] = useState<string | 'ALL'>('ALL');
  const [nameQuery, setNameQuery] = useState('');
  const deferredNameQuery = useDeferredValue(nameQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    const q = normalizeMatchText(deferredNameQuery);
    if (!q) return filteredByInterns;
    return filteredByInterns.filter((company) => {
      const display = normalizeMatchText(getCompanyDisplayName(company));
      const legal = normalizeMatchText(company.name);
      const fantasy = normalizeMatchText(company.tradeName);
      return display.includes(q) || legal.includes(q) || fantasy.includes(q);
    });
  }, [filteredByInterns, deferredNameQuery]);

  const states = useMemo(() => listStates(filteredByName), [filteredByName]);

  useEffect(() => {
    if (selectedState === 'ALL') return;
    const stillExists = states.some((s) => s === selectedState);
    if (!stillExists) setSelectedState('ALL');
  }, [states, selectedState]);

  const filteredByState = useMemo(
    () => filterByState(filteredByName, selectedState),
    [filteredByName, selectedState]
  );

  const cities = useMemo(() => listCities(filteredByState), [filteredByState]);
  const [selectedCity, setSelectedCity] = useState(DEFAULT_MAP_CITY);
  const didInitCityRef = useRef(false);
  selectedCityRef.current = selectedCity;

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
    setSelectedState('ALL');
  }, [focusMapRequest, companies, selectedCity]);

  const companiesInCity = useMemo(
    () => filterByCity(filteredByState, selectedCity),
    [filteredByState, selectedCity]
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

  const withActiveInCity = useMemo(
    () =>
      filterByCity(filterByState(filteredByGroup, selectedState), selectedCity).filter(
        (c) => (c.activeTrainees ?? 0) > 0
      ).length,
    [filteredByGroup, selectedState, selectedCity]
  );
  const withoutActiveInCity = useMemo(
    () =>
      filterByCity(filterByState(filteredByGroup, selectedState), selectedCity).filter(
        (c) => (c.activeTrainees ?? 0) === 0
      ).length,
    [filteredByGroup, selectedState, selectedCity]
  );

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

  const selectedStateLabel = selectedState === 'ALL' ? 'Todos os estados' : selectedState;

  const stateOptions = useMemo(
    () => [
      {
        value: 'ALL',
        label: 'Todos os estados',
        hint: String(filteredByName.length),
      },
      ...states.map((state) => ({
        value: state,
        label: state,
        hint: String(filterByState(filteredByName, state).length),
      })),
    ],
    [states, filteredByName]
  );

  const cityOptions = useMemo(
    () =>
      cities.map((city) => ({
        value: city,
        label: city,
        hint: String(filterByCity(filteredByState, city).length),
      })),
    [cities, filteredByState]
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
      preferCanvas: true,
      fadeAnimation: false,
      markerZoomAnimation: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapInstanceRef.current = map;

    const invalidate = () => map.invalidateSize();
    requestAnimationFrame(invalidate);
    window.setTimeout(invalidate, 200);
    window.addEventListener('resize', invalidate);

    return () => {
      window.removeEventListener('resize', invalidate);
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      markersRef.current = {};
      markerSignatureRef.current = {};
    };
  }, []);

  // Remount oculto → corrige tamanho ao voltar para a aba mapa
  useEffect(() => {
    if (!isActive) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const t1 = window.requestAnimationFrame(() => map.invalidateSize());
    const t2 = window.setTimeout(() => map.invalidateSize(), 120);
    return () => {
      window.cancelAnimationFrame(t1);
      window.clearTimeout(t2);
    };
  }, [isActive]);

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
        map.flyTo(neigh.center, 15, { duration: 0.7, easeLinearity: 0.3 });
        return;
      }
    }

    const center = cityCenter(companiesInCity);
    map.flyTo(center, companiesInCity.length > 0 ? 12.5 : 11, { duration: 0.55 });
  }, [selectedNeighborhoodId, neighborhoods, selectedCity, companiesInCity]);

  // Ao definir localização: seleciona a CIDADE e centraliza nela (não no ponto GPS exato)
  useEffect(() => {
    if (!userLocation || !locationReady) return;
    if (didAutoCityFromGpsRef.current) return;
    didAutoCityFromGpsRef.current = true;

    const city = resolveMapCityForLocation(filteredByState, userLocation, locationSource);
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

    const gen = ++markerSyncGenRef.current;
    const visitIds = companiesWithVisitIds;
    const positionedCompanies = spreadOverlappingCompanies(visibleCompanies);
    const nextIds = new Set(positionedCompanies.map((c) => c.id));
    const byId = new Map<string, Company>();

    for (const company of positionedCompanies) {
      byId.set(company.id, company);
    }
    companiesByIdRef.current = byId;

    for (const id of Object.keys(markersRef.current)) {
      if (!nextIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
        delete markerSignatureRef.current[id];
      }
    }

    type Positioned = (typeof positionedCompanies)[number];
    const toCreate: Positioned[] = [];

    const attachLazyPopup = (marker: L.Marker, companyId: string) => {
      marker.unbindPopup();
      marker.bindPopup('<div style="min-width:120px;padding:8px;color:#64748b;font-size:12px">Carregando…</div>');
      marker.off('popupopen');
      marker.on('popupopen', (e) => {
        const company = companiesByIdRef.current.get(companyId);
        if (!company) return;
        const nextVisit = getNextVisitRef.current?.(companyId) || null;
        const mapsUrl = googleMapsCompanyUrl(company, userLocationRef.current);
        const html = buildCompanyPopupHtml(
          company,
          selectedCityRef.current,
          nextVisit,
          mapsUrl
        );
        const popup = e.popup;
        popup.setContent(html);
        const el = popup.getElement();
        const detailsBtn = el?.querySelector<HTMLButtonElement>('[data-action="details"]');
        if (detailsBtn) {
          detailsBtn.onclick = () => {
            const current = companiesByIdRef.current.get(companyId);
            if (current) handlersRef.current.onSelectCompany(current);
          };
        }
      });
    };

    for (const company of positionedCompanies) {
      const displayName = getCompanyDisplayName(company);
      const shortLabel = shortCompanyLabel(displayName);
      const hasActive = (company.activeTrainees ?? 0) > 0;
      const hasVisit = visitIds?.has(company.id) ?? false;
      const kind = pinKind(hasVisit, hasActive);
      const signature = `${company.mapLat.toFixed(6)}|${company.mapLng.toFixed(6)}|${kind}|${shortLabel}`;
      const existing = markersRef.current[company.id];

      if (existing) {
        if (markerSignatureRef.current[company.id] !== signature) {
          existing.setLatLng([company.mapLat, company.mapLng]);
          existing.setIcon(getCompanyPinIcon(kind, shortLabel));
          markerSignatureRef.current[company.id] = signature;
        }
      } else {
        toCreate.push(company);
      }
    }

    let index = 0;
    const CHUNK = 40;

    const createChunk = () => {
      if (gen !== markerSyncGenRef.current) return;
      const end = Math.min(index + CHUNK, toCreate.length);

      for (; index < end; index++) {
        const company = toCreate[index];
        const displayName = getCompanyDisplayName(company);
        const shortLabel = shortCompanyLabel(displayName);
        const hasActive = (company.activeTrainees ?? 0) > 0;
        const hasVisit = visitIds?.has(company.id) ?? false;
        const kind = pinKind(hasVisit, hasActive);
        const signature = `${company.mapLat.toFixed(6)}|${company.mapLng.toFixed(6)}|${kind}|${shortLabel}`;

        const marker = L.marker([company.mapLat, company.mapLng], {
          icon: getCompanyPinIcon(kind, shortLabel),
        }).addTo(map);

        attachLazyPopup(marker, company.id);
        markersRef.current[company.id] = marker;
        markerSignatureRef.current[company.id] = signature;
      }

      if (index < toCreate.length) {
        window.requestAnimationFrame(createChunk);
      }
    };

    if (toCreate.length > 0) {
      createChunk();
    }

    return () => {
      // invalida chunks em andamento ao mudar filtros
      markerSyncGenRef.current += 1;
    };
  }, [visibleCompanies, companiesWithVisitIds]);

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
      const lat = company.lat;
      const lng = company.lng;

      map.flyTo([lat, lng], 17, { duration: 0.75, easeLinearity: 0.3 });

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

  const filterPanel = (
    <div className="space-y-5">
      <section className="rounded-xl border border-border/70 bg-muted/30 p-3 space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sua localização
        </Label>
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
            Cidade detectada pela sua região
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Padrão: Fortaleza · toque para detectar a sua
          </p>
        )}
        {locationError && !usingGps && (
          <p className="text-[11px] text-muted-foreground">{locationError}</p>
        )}
      </section>

      <section className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Buscar empresa
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-9 bg-background"
            placeholder="Nome fantasia ou razão social..."
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
      </section>

      <section className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Estagiários
        </Label>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/70 bg-muted/40 p-1">
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
                  'flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-[11px] font-semibold transition cursor-pointer',
                  active
                    ? 'bg-card text-foreground shadow-sm border border-border/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-background p-3 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Região e grupo
        </p>

        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Estado</Label>
          <SearchableSelect
            value={selectedState}
            options={stateOptions}
            placeholder="Escolher estado"
            searchPlaceholder="Buscar estado..."
            onChange={(value) => {
              setSelectedState(value === 'ALL' ? 'ALL' : value);
              onSelectNeighborhood('ALL');
            }}
          />
        </div>

        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Bairro</Label>
          <SearchableSelect
            value={selectedNeighborhoodId}
            options={neighborhoodOptions}
            placeholder="Escolher bairro"
            searchPlaceholder="Buscar bairro..."
            onChange={onSelectNeighborhood}
          />
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-border/70 bg-muted/40 px-2 py-2.5">
          <p className="text-base font-bold text-foreground leading-none">
            {visibleCompanies.length}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">no mapa</p>
        </div>
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800/40 px-2 py-2.5">
          <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 leading-none">
            {withActiveInCity}
          </p>
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">
            com ativos
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/40 px-2 py-2.5">
          <p className="text-base font-bold leading-none">{withoutActiveInCity}</p>
          <p className="text-[10px] text-muted-foreground mt-1">sem ativos</p>
        </div>
      </section>
    </div>
  );

  return (
    <div className="flex w-full h-[calc(100vh-7.5rem)] min-h-[480px] rounded-2xl overflow-hidden border border-border/80 bg-card shadow-inner shadow-black/5 dark:shadow-black/40">
      {/* Painel lateral de filtros — não cobre o mapa */}
      <aside className="hidden lg:flex w-[300px] xl:w-[320px] shrink-0 flex-col border-r bg-card">
        <div className="p-4 border-b shrink-0">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Filter className="size-4 text-primary" />
            Filtros do mapa
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            {nameQuery.trim() ? `“${nameQuery.trim()}” · ` : ''}
            {internLabel} · {selectedGroupLabel} · {selectedStateLabel} · {selectedCity}
            {selectedNeighborhoodId !== 'ALL' ? ` · ${selectedNeighborhoodLabel}` : ''}
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">{filterPanel}</div>
        </ScrollArea>
      </aside>

      <div className="relative flex-1 min-w-0 bg-muted">
        {/* Mobile: filtros em Sheet (não overlay permanente) */}
        <div className="absolute top-3 left-3 z-[1000] lg:hidden flex gap-2">
          <Button className="shadow-lg" onClick={() => setFiltersOpen(true)}>
            <Filter />
            Filtros
            <Badge variant="secondary" className="ml-1">
              {visibleCompanies.length}
            </Badge>
          </Button>
        </div>

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="left" className="w-[min(100%,360px)] p-0 flex flex-col">
            <SheetHeader className="p-4 border-b text-left">
              <SheetTitle className="text-sm flex items-center gap-2">
                <Filter className="size-4 text-primary" />
                Filtros do mapa
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <div className="p-4">{filterPanel}</div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <div className="absolute top-3 right-3 z-[1000] w-[min(100%-1.5rem,340px)] hidden sm:block max-h-[calc(100%-1.5rem)]">
          {routeOpen ? (
            <div className="relative max-h-full flex flex-col min-h-0">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2.5 right-2.5 z-10 size-7 bg-card/90 hover:bg-muted"
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

        <div className="absolute bottom-4 left-3 right-3 z-[1000] flex flex-col gap-2 max-w-[calc(100%-1.5rem)] sm:max-w-md lg:left-4">
          <div className="flex items-start gap-2 rounded-xl border bg-card/95 backdrop-blur px-3 py-2 shadow-md text-[11px] leading-snug text-muted-foreground">
            <Info className="size-3.5 text-primary shrink-0 mt-0.5" />
            <p>
              Os pins são <span className="font-medium text-foreground">aproximados</span> (CEP/bairro).
              Para o endereço certo, abra o <span className="font-medium text-foreground">Google Maps</span> no popup.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="secondary"
              className="shadow-md bg-card/95 backdrop-blur border px-3 py-1.5 truncate"
            >
              <MapPin className="size-3.5 text-primary mr-1 shrink-0" />
              {selectedCity}
              {selectedNeighborhoodId !== 'ALL' ? ` · ${selectedNeighborhoodLabel}` : ''}
            </Badge>
            <div className="flex items-center gap-1.5 rounded-full border bg-card/95 backdrop-blur px-2.5 py-1 shadow-md text-[10px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-500" /> ativos
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-rose-500" /> sem
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-amber-500" /> visita
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
