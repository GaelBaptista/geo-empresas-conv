import { Map, Calendar, Trophy, Tv, MapPin, RefreshCw, LogOut } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/button';
import type { ViewMode } from '@/types';

const NAV_ITEMS: {
  id: ViewMode;
  label: string;
  icon: typeof Map;
  countKey?: 'pending';
}[] = [
  { id: 'map', label: 'Mapa', icon: Map },
  { id: 'visits', label: 'Agenda', icon: Calendar, countKey: 'pending' },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  // { id: 'dashboardTv', label: 'Dashboard TV', icon: Tv },
];

interface AppSidebarProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onRequestReset: () => void;
  onSignOut?: () => void;
  userName?: string | null;
  upcomingVisitCount: number;
}

export function AppSidebar({
  activeView,
  onViewChange,
  onRequestReset,
  onSignOut,
  userName,
  upcomingVisitCount,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-1 py-1 group-data-[collapsible=icon]:justify-center">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm shrink-0">
            <MapPin className="size-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="font-display text-base font-semibold leading-tight tracking-tight">
              Geolocalização
            </p>
            <p className="text-[11px] text-muted-foreground truncate">de empresas</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const count =
                  item.countKey === 'pending' && upcomingVisitCount > 0
                    ? upcomingVisitCount
                    : null;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={activeView === item.id}
                      tooltip={item.label}
                      onClick={() => onViewChange(item.id)}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {count != null && (
                      <SidebarMenuBadge className="bg-visit/15 text-visit border border-visit/20">
                        {count}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
          <ThemeToggle className="shrink-0" />
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
            onClick={onRequestReset}
          >
            <RefreshCw className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden">Recarregar</span>
          </Button>
        </div>
        {onSignOut && (
          <div className="space-y-1 group-data-[collapsible=icon]:space-y-2">
            {userName && (
              <p
                className="px-2 text-[11px] text-muted-foreground truncate group-data-[collapsible=icon]:hidden"
                title={userName}
              >
                {userName}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
              onClick={onSignOut}
            >
              <LogOut className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">Sair</span>
            </Button>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
