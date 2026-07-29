import { useCallback, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAppData } from '@/hooks/useAppData';
import { useUserLocation } from '@/hooks/useUserLocation';
import { setUnauthorizedHandler } from '@/lib/api';
import { LoginPage } from '@/components/auth/LoginPage';
import { AppShell } from '@/components/layout/AppShell';
import { ResetDataDialog } from '@/components/layout/ResetDataDialog';
import { LocationRequiredGate } from '@/components/location/LocationRequiredGate';
import { MapView } from '@/components/map/MapView';
import { CompanyDetailSheet } from '@/components/companies/CompanyDetailSheet';
import { SchedulesAgenda } from '@/components/visits/SchedulesAgenda';
import { HiringRankPanel } from '@/components/dashboard/HiringRankPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function App() {
  const { user, isAuthenticated, isSigningIn, authError, signIn, signOut } = useAuth();

  const {
    position: userLocation,
    source: locationSource,
    errorMessage: locationError,
    isReady: locationReady,
    isRequesting: locationRequesting,
    isPending: locationPending,
    usingFortalezaFallback,
    requestLocation,
    useFortaleza,
  } = useUserLocation();

  const handleUnauthorized = useCallback(() => {
    signOut();
  }, [signOut]);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [handleUnauthorized]);
  const {
    companies,
    groups,
    neighborhoods,
    schedules,
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
    reloadCompanies,
    handleResetData,
    handleFocusOnMap,
    linkScheduleToCompany,
    unlinkScheduleCompany,
  } = useAppData({
    enabled: isAuthenticated,
    onUnauthorized: handleUnauthorized,
  });

  if (!isAuthenticated) {
    return (
      <LoginPage
        isLoading={isSigningIn}
        error={authError}
        onSubmit={async (cpf, password) => {
          await signIn(cpf, password);
        }}
      />
    );
  }

  const needsLocationGate = locationPending;

  return (
    <>
      <LocationRequiredGate
        open={needsLocationGate}
        isRequesting={locationRequesting}
        onAllow={requestLocation}
        onUseFortaleza={useFortaleza}
      />

      <AppShell
        activeView={activeView}
        onViewChange={setActiveView}
        onRequestReset={() => setIsResetDialogOpen(true)}
        onSignOut={signOut}
        userName={user?.name}
        upcomingVisitCount={upcomingVisitCount}
      >
        {usingFortalezaFallback && locationError && (
          <Card className="mb-4 border-sky-200/80 bg-sky-50/80 dark:border-sky-800/50 dark:bg-sky-950/40">
            <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
              <div className="flex items-start gap-2 flex-1 text-sky-950 dark:text-sky-100">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <span>{locationError}</span>
              </div>
              <Button variant="outline" size="sm" onClick={requestLocation}>
                Detectar cidade de novo
              </Button>
            </CardContent>
          </Card>
        )}
        {isLoadingCompanies && (
          <Card className="mb-4">
            <CardContent className="p-4 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Carregando empresas e agenda...
            </CardContent>
          </Card>
        )}

        {companiesError && (
          <Card className="mb-4 border-amber-200/80 bg-amber-50/80 dark:border-amber-800/50 dark:bg-amber-950/40">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
              <div className="flex items-start gap-2 flex-1 text-amber-900 dark:text-amber-100">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <span>{companiesError}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void reloadCompanies()}>
                <RefreshCw />
                Tentar de novo
              </Button>
            </CardContent>
          </Card>
        )}

        {schedulesError && (
          <Card className="mb-4 border-rose-200/80 bg-rose-50/80 dark:border-rose-800/50 dark:bg-rose-950/40">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
              <div className="flex items-start gap-2 flex-1 text-rose-900 dark:text-rose-100">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <span>{schedulesError}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void reloadCompanies()}>
                <RefreshCw />
                Recarregar agenda
              </Button>
            </CardContent>
          </Card>
        )}

        {activeView === 'map' && (
          <MapView
            companies={companies}
            neighborhoods={neighborhoods}
            groups={groups}
            schedules={schedules}
            selectedNeighborhoodId={selectedNeighborhoodId}
            focusMapRequest={focusMapRequest}
            onFocusConsumed={clearFocusMapRequest}
            companiesWithVisitIds={companiesWithVisitIds}
            getNextVisitForCompany={getNextVisitForCompany}
            onSelectCompany={setSelectedCompanyForDossier}
            onSelectNeighborhood={setSelectedNeighborhoodId}
            onFocusCompany={handleFocusOnMap}
            userLocation={userLocation}
            locationSource={locationSource}
            locationReady={locationReady}
            locationRequesting={locationRequesting}
            locationError={locationError}
            onRequestLocation={requestLocation}
          />
        )}

        {activeView === 'visits' && (
          <SchedulesAgenda
            schedules={schedules}
            companies={companies}
            onSelectCompanyById={(companyId) => {
              const comp = companies.find((c) => c.id === companyId);
              if (comp) setSelectedCompanyForDossier(comp);
            }}
            onFocusCompanyOnMap={(companyId) => {
              const comp = companies.find((c) => c.id === companyId);
              if (comp) handleFocusOnMap(comp);
            }}
            onLinkCompany={linkScheduleToCompany}
            onUnlinkCompany={unlinkScheduleCompany}
          />
        )}

        {activeView === 'ranking' && (
          <div className="space-y-4 max-w-5xl">
            {minivagasError && (
              <Card className="border-amber-200 bg-amber-50/70">
                <CardContent className="p-3 text-sm text-amber-900">{minivagasError}</CardContent>
              </Card>
            )}
            {!minivagas && !minivagasError && (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Carregando ranking do Minivagas...
                </CardContent>
              </Card>
            )}
            {minivagas && (
              <>
                <p className="text-xs text-muted-foreground px-1">
                  {minivagas.matchedObservacoes} empresa(s) com observação ·{' '}
                  {minivagas.matchedHiring} com histórico de candidatura (mesmo CNPJ do mapa).
                </p>
                <HiringRankPanel
                  bundle={minivagas}
                  companies={companies}
                  onSelectCompany={setSelectedCompanyForDossier}
                />
              </>
            )}
          </div>
        )}
      </AppShell>

      <CompanyDetailSheet
        company={selectedCompanyForDossier}
        schedules={schedules}
        minivagasExtras={
          selectedCompanyForDossier ? getMinivagasExtras(selectedCompanyForDossier) : null
        }
        onClose={() => setSelectedCompanyForDossier(null)}
        onFocusOnMap={handleFocusOnMap}
      />

      <ResetDataDialog
        open={isResetDialogOpen}
        onOpenChange={setIsResetDialogOpen}
        onConfirm={handleResetData}
      />
    </>
  );
}
