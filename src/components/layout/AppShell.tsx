import { Map, Calendar, Trophy, MapPin, Menu, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { VIEW_META } from '@/constants/domain';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/types';
import { useState } from 'react';

const NAV_ITEMS: {
  id: ViewMode;
  label: string;
  icon: typeof Map;
  countKey?: 'pending';
}[] = [
  { id: 'map', label: 'Mapa', icon: Map },
  { id: 'visits', label: 'Agenda', icon: Calendar, countKey: 'pending' },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
];

interface AppShellProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onRequestReset: () => void;
  onSignOut?: () => void;
  userName?: string | null;
  upcomingVisitCount: number;
  children: React.ReactNode;
}

function NavButton({
  item,
  active,
  onClick,
  upcomingVisitCount,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  onClick: () => void;
  upcomingVisitCount: number;
}) {
  const Icon = item.icon;
  const count =
    item.countKey === 'pending' && upcomingVisitCount > 0 ? upcomingVisitCount : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all cursor-pointer',
        active
          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
          : 'text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground'
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 text-left">{item.label}</span>
      {count !== null && (
        <Badge
          variant={active ? 'secondary' : 'warning'}
          className={cn(active && 'bg-white/20 text-inherit border-transparent')}
        >
          {count}
        </Badge>
      )}
    </button>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="size-10 rounded-2xl bg-gradient-to-br from-primary to-teal-700 dark:to-teal-500 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/25 shrink-0">
        <MapPin className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold text-foreground leading-tight tracking-tight">
          Geolocalização
        </p>
        <p className="text-[11px] text-muted-foreground truncate">Empresas conveniadas · CE</p>
      </div>
    </div>
  );
}

function SidebarNav({
  activeView,
  onViewChange,
  upcomingVisitCount,
  onNavigate,
}: {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  upcomingVisitCount: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavButton
          key={item.id}
          item={item}
          active={activeView === item.id}
          upcomingVisitCount={upcomingVisitCount}
          onClick={() => {
            onViewChange(item.id);
            onNavigate?.();
          }}
        />
      ))}
    </nav>
  );
}

function SidebarFooter({
  onRequestReset,
  onSignOut,
  userName,
  onNavigate,
}: {
  onRequestReset: () => void;
  onSignOut?: () => void;
  userName?: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="p-3 space-y-2 border-t border-border/70">
      <div className="flex items-center gap-2">
        <ThemeToggle className="shrink-0" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="flex-1 justify-start"
              onClick={() => {
                onRequestReset();
                onNavigate?.();
              }}
            >
              <RefreshCw />
              Recarregar
            </Button>
          </TooltipTrigger>
          <TooltipContent>Recarregar empresas e agenda da API</TooltipContent>
        </Tooltip>
      </div>
      {onSignOut && (
        <div className="space-y-1">
          {userName && (
            <p className="px-2 text-[11px] text-muted-foreground truncate" title={userName}>
              {userName}
            </p>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onSignOut();
              onNavigate?.();
            }}
          >
            <LogOut />
            Sair
          </Button>
        </div>
      )}
    </div>
  );
}

export function AppShell({
  activeView,
  onViewChange,
  onRequestReset,
  onSignOut,
  userName,
  upcomingVisitCount,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = VIEW_META[activeView];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen flex">
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border/70 bg-card/70 backdrop-blur-xl">
          <div className="p-5">
            <Brand />
          </div>
          <Separator className="opacity-70" />
          <div className="flex-1 p-3">
            <SidebarNav
              activeView={activeView}
              onViewChange={onViewChange}
              upcomingVisitCount={upcomingVisitCount}
            />
          </div>
          <SidebarFooter
            onRequestReset={onRequestReset}
            onSignOut={onSignOut}
            userName={userName}
          />
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 border-b border-border/70 bg-card/75 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-16">
              <div className="flex items-center gap-3 min-w-0">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden shrink-0">
                      <Menu />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72 p-0 flex flex-col">
                    <SheetHeader className="p-5 text-left border-b">
                      <SheetTitle className="sr-only">Navegação</SheetTitle>
                      <Brand />
                    </SheetHeader>
                    <div className="flex-1 p-3">
                      <SidebarNav
                        activeView={activeView}
                        onViewChange={onViewChange}
                        upcomingVisitCount={upcomingVisitCount}
                        onNavigate={() => setMobileOpen(false)}
                      />
                    </div>
                    <SidebarFooter
                      onRequestReset={onRequestReset}
                      onSignOut={onSignOut}
                      userName={userName}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  </SheetContent>
                </Sheet>

                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-semibold text-foreground truncate tracking-tight">
                    {meta.title}
                  </h1>
                  <p className="text-xs text-muted-foreground hidden sm:block truncate">
                    {meta.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 lg:hidden">
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
