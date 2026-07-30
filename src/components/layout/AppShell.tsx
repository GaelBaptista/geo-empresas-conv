import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { VIEW_META } from '@/constants/domain';
import type { ViewMode } from '@/types';

interface AppShellProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onRequestReset: () => void;
  onSignOut?: () => void;
  userName?: string | null;
  upcomingVisitCount: number;
  children: React.ReactNode;
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
  const meta = VIEW_META[activeView];

  return (
    <SidebarProvider>
      <AppSidebar
        activeView={activeView}
        onViewChange={onViewChange}
        onRequestReset={onRequestReset}
        onSignOut={onSignOut}
        userName={userName}
        upcomingVisitCount={upcomingVisitCount}
      />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-card/80 px-3 backdrop-blur-xl sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
              {meta.title}
            </h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {meta.description}
            </p>
          </div>
          <ThemeToggle className="md:hidden" />
        </header>
        <div className="flex-1 overflow-auto p-3 sm:p-5 lg:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
