import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_COMPANIES, FORTALEZA_NEIGHBORHOODS } from '@/data/fortalezaData';
import { clearLegacyGeocodeCaches } from '@/lib/geocode';
import {
  applyManualMatches,
  companyIdsWithUpcomingVisits,
  getVisitSchedulesInWindow,
  matchSchedulesToCompanies,
  nextVisitForCompany,
} from '@/lib/schedule-match';
import {
  clearManualMatch,
  loadManualMatches,
  setManualMatch,
  type ManualMatches,
} from '@/lib/manual-schedule-match';
import {
  buildNeighborhoodsFromCompanies,
  enrichCompaniesWithGroupsAndContracts,
  fetchCompaniesFromApi,
} from '@/services/companiesApi';
import {
  countActiveTraineesByCompany,
  fetchActiveContracts,
} from '@/services/contractsApi';
import { fetchGroupOptions, type GroupOption } from '@/services/groupsApi';
import { fetchSchedules } from '@/services/schedulesApi';
import {
  extrasForCompany,
  loadMinivagasBundle,
  type CompanyMinivagasExtras,
  type MinivagasBundle,
} from '@/services/minivagasApi';
import type { Company, ScheduleItem, ViewMode } from '@/types';

const USE_API = import.meta.env.VITE_USE_API !== 'false';

export type FocusMapRequest = {
  companyId: string;
  token: number;
};

export function useAppData(options?: { enabled?: boolean; onUnauthorized?: () => void }) {
  const enabled = options?.enabled ?? true;
  const onUnauthorized = options?.onUnauthorized;

  const [companies, setCompanies] = useState<Company[]>(USE_API ? [] : DEFAULT_COMPANIES);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [manualMatches, setManualMatches] = useState<ManualMatches>(() => loadManualMatches());
  const [activeView, setActiveView] = useState<ViewMode>('map');
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState('ALL');
  const [selectedCompanyForDossier, setSelectedCompanyForDossier] = useState<Company | null>(null);
  const [focusMapRequest, setFocusMapRequest] = useState<FocusMapRequest | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [schedulesError, setSchedulesError] = useState<string | null>(null);
  const [minivagas, setMinivagas] = useState<MinivagasBundle | null>(null);
  const [minivagasError, setMinivagasError] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const focusTokenRef = useRef(0);
  const companiesRef = useRef(companies);
  companiesRef.current = companies;

  /** Refresh silencioso do Minivagas + freeze — a cada 5 min com a aba visível. */
  const MINIVAGAS_REFRESH_MS = 5 * 60 * 1000;

  const neighborhoods = useMemo(
    () => buildNeighborhoodsFromCompanies(companies, FORTALEZA_NEIGHBORHOODS),
    [companies]
  );

  const matchedSchedules = useMemo(
    () =>
      applyManualMatches(matchSchedulesToCompanies(schedules, companies), companies, manualMatches),
    [schedules, companies, manualMatches]
  );

  const companiesWithVisitIds = useMemo(
    () => companyIdsWithUpcomingVisits(matchedSchedules),
    [matchedSchedules]
  );

  const upcomingVisitCount = useMemo(
    () =>
      getVisitSchedulesInWindow(matchedSchedules, 'today').filter((s) => Boolean(s.matchedCompanyId))
        .length,
    [matchedSchedules]
  );

  const loadCompanies = useCallback(async () => {
    if (!enabled) {
      setIsLoadingCompanies(false);
      return;
    }

    if (!USE_API) {
      setCompanies(DEFAULT_COMPANIES);
      setGroups([]);
      setSchedules([]);
      setMinivagas(null);
      setMinivagasError(null);
      setIsLoadingCompanies(false);
      setCompaniesError(null);
      setSchedulesError(null);
      return;
    }

    const loadId = ++loadRequestIdRef.current;
    setIsLoadingCompanies(true);
    setCompaniesError(null);
    setSchedulesError(null);
    setMinivagasError(null);

    try {
      const [companiesResult, groupsResult, contractsResult, schedulesResult] =
        await Promise.allSettled([
          fetchCompaniesFromApi(),
          fetchGroupOptions(),
          fetchActiveContracts(),
          fetchSchedules({ me: false }),
        ]);

      if (loadId !== loadRequestIdRef.current) return;

      if (companiesResult.status === 'rejected') {
        const e = companiesResult.reason;
        console.error('Erro ao carregar empresas da API', e);
        const status =
          typeof e === 'object' && e && 'response' in e
            ? (e as { response?: { status?: number } }).response?.status
            : undefined;

        if (status === 401) {
          setCompaniesError('Sessão expirada. Faça login novamente.');
          onUnauthorized?.();
        } else {
          setCompaniesError(
            'Não foi possível carregar as empresas da API. Verifique a URL e a conexão.'
          );
        }
        setCompanies([]);
        setGroups([]);
        setSchedules([]);
        setMinivagas(null);
        setIsLoadingCompanies(false);
        return;
      }

      const apiCompanies = companiesResult.value;
      const groupOptions =
        groupsResult.status === 'fulfilled' ? groupsResult.value : ([] as GroupOption[]);
      const activeContracts = contractsResult.status === 'fulfilled' ? contractsResult.value : [];

      if (groupsResult.status === 'rejected') {
        console.warn('Falha ao carregar grupos', groupsResult.reason);
      }
      if (contractsResult.status === 'rejected') {
        console.warn('Falha ao carregar contratos ativos', contractsResult.reason);
      }

      if (schedulesResult.status === 'fulfilled') {
        setSchedules(schedulesResult.value);
        setSchedulesError(null);
      } else {
        console.warn('Falha ao carregar agenda', schedulesResult.reason);
        setSchedules([]);
        setSchedulesError(
          'Não carregou a agenda. Visitas no mapa podem estar desatualizadas. Tente de novo.'
        );
      }

      const activeCounts = countActiveTraineesByCompany(activeContracts);
      const enriched = enrichCompaniesWithGroupsAndContracts(
        apiCompanies,
        groupOptions,
        activeCounts
      );

      setGroups(groupOptions);
      setCompanies(enriched);
      setIsLoadingCompanies(false);

      void loadMinivagasBundle(enriched)
        .then((bundle) => {
          if (loadId !== loadRequestIdRef.current) return;
          if (!bundle) {
            setMinivagas(null);
            setMinivagasError(
              'Token do Minivagas não configurado. Defina VITE_PUBLIC_TOKEN no .env (ou nas variáveis do deploy) e faça o build de novo.'
            );
            return;
          }
          setMinivagas(bundle);
          setMinivagasError(null);
        })
        .catch((err) => {
          if (loadId !== loadRequestIdRef.current) return;
          console.warn('Falha ao carregar Minivagas', err);
          setMinivagas(null);
          setMinivagasError(
            'Não carregou observações/ranking do Minivagas. Verifique VITE_PUBLIC_TOKEN e a conexão com apiminivagas.estagius.com.br.'
          );
        });
    } catch (e: unknown) {
      if (loadId !== loadRequestIdRef.current) return;
      console.error('Erro ao carregar empresas da API', e);
      const status =
        typeof e === 'object' && e && 'response' in e
          ? (e as { response?: { status?: number } }).response?.status
          : undefined;

      if (status === 401) {
        setCompaniesError('Sessão expirada. Faça login novamente.');
        onUnauthorized?.();
      } else {
        setCompaniesError(
          'Não foi possível carregar as empresas da API. Verifique a URL e a conexão.'
        );
      }
      setCompanies([]);
      setGroups([]);
      setSchedules([]);
      setMinivagas(null);
      setIsLoadingCompanies(false);
    }
  }, [enabled, onUnauthorized]);

  useEffect(() => {
    if (!enabled) {
      setCompanies([]);
      setGroups([]);
      setSchedules([]);
      setMinivagas(null);
      setMinivagasError(null);
      setIsLoadingCompanies(false);
      setCompaniesError(null);
      setSchedulesError(null);
      return;
    }
    clearLegacyGeocodeCaches();
    void loadCompanies();
  }, [enabled, loadCompanies]);

  useEffect(() => {
    if (!enabled || !USE_API) return;

    const refreshMinivagas = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const list = companiesRef.current;
      if (!list.length) return;
      void loadMinivagasBundle(list)
        .then((bundle) => {
          if (!bundle) return;
          setMinivagas(bundle);
          setMinivagasError(null);
        })
        .catch((err) => {
          console.warn('Falha no refresh silencioso do Minivagas', err);
        });
    };

    const id = window.setInterval(refreshMinivagas, MINIVAGAS_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [enabled]);

  const handleResetData = useCallback(() => {
    setSelectedCompanyForDossier(null);
    setFocusMapRequest(null);
    setIsResetDialogOpen(false);
    void loadCompanies();
  }, [loadCompanies]);

  const softReload = useCallback(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const handleFocusOnMap = useCallback((company: Company) => {
    focusTokenRef.current += 1;
    setSelectedNeighborhoodId(company.neighborhoodId);
    setSelectedCompanyForDossier(null);
    setFocusMapRequest({ companyId: company.id, token: focusTokenRef.current });
    setActiveView('map');
  }, []);

  const clearFocusMapRequest = useCallback(() => {
    setFocusMapRequest(null);
  }, []);

  const getNextVisitForCompany = useCallback(
    (companyId: string) => nextVisitForCompany(matchedSchedules, companyId, 'upcoming'),
    [matchedSchedules]
  );

  const getMinivagasExtras = useCallback(
    (company: Company): CompanyMinivagasExtras | null => {
      if (!minivagas) return null;
      return extrasForCompany(
        company,
        minivagas.observacoesByCnpj,
        minivagas.hiringByCnpj,
        minivagas.hiringByCnpjMonth,
        minivagas.reputationByCnpj,
        minivagas.reputationByCnpjMonth
      );
    },
    [minivagas]
  );

  const linkScheduleToCompany = useCallback((scheduleId: string, companyId: string) => {
    setManualMatches(setManualMatch(scheduleId, companyId));
  }, []);

  const unlinkScheduleCompany = useCallback((scheduleId: string) => {
    setManualMatches(clearManualMatch(scheduleId));
  }, []);

  return {
    companies,
    groups,
    neighborhoods,
    schedules: matchedSchedules,
    companiesWithVisitIds,
    upcomingVisitCount,
    getNextVisitForCompany,
    getMinivagasExtras,
    minivagas,
    minivagasError,
    activeView,
    setActiveView,
    selectedNeighborhoodId,
    setSelectedNeighborhoodId,
    selectedCompanyForDossier,
    setSelectedCompanyForDossier,
    focusMapRequest,
    clearFocusMapRequest,
    isResetDialogOpen,
    setIsResetDialogOpen,
    isLoadingCompanies,
    companiesError,
    schedulesError,
    reloadCompanies: softReload,
    handleResetData,
    handleFocusOnMap,
    linkScheduleToCompany,
    unlinkScheduleCompany,
  };
}
