import { useState } from 'react';
import { Loader2, MapPin, Building2, Navigation, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface LoginPageProps {
  onSubmit: (cpf: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

const fieldClass = cn(
  'h-12 w-full rounded-full border-0 bg-muted/70 px-5 text-sm text-foreground',
  'placeholder:text-muted-foreground/70',
  'outline-none ring-0 transition-[box-shadow,background-color]',
  'focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-primary/35',
  'disabled:opacity-60',
);

export function LoginPage({ onSubmit, isLoading, error }: LoginPageProps) {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit(cpf, password);
    } catch {
      // erro já tratado em useAuth (authError)
    }
  };

  return (
    <TooltipProvider>
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6 lg:px-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 top-16 size-72 rounded-full bg-primary/[0.06] blur-3xl dark:bg-primary/10" />
          <div className="absolute -right-16 bottom-10 size-80 rounded-full bg-primary/[0.05] blur-3xl dark:bg-primary/[0.08]" />
        </div>

        <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
          <ThemeToggle className="bg-card border-border/60 shadow-sm" />
        </div>

        <div
          className={cn(
            'relative z-10 grid w-full max-w-5xl overflow-hidden',
            'rounded-[2rem] border border-border/50 bg-card shadow-[0_25px_80px_-20px_rgba(0,0,0,0.18)]',
            'dark:shadow-[0_25px_80px_-20px_rgba(0,0,0,0.55)]',
            'lg:grid-cols-2 animate-in fade-in-0 zoom-in-95 duration-500',
          )}
        >
          {/* Formulário */}
          <main className="flex flex-col justify-center px-7 py-9 sm:px-10 sm:py-12 lg:px-12 lg:py-14 order-2 lg:order-1">
            <div className="mb-8 space-y-4">
              <div className="inline-flex items-center gap-2 text-primary">
                <span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary/10">
                  <MapPin className="size-4" />
                </span>
                <span className="text-sm font-semibold tracking-tight">geolocalização</span>
              </div>

              <div className="space-y-2">
                <h1 className="font-display text-[1.85rem] sm:text-[2.15rem] font-semibold leading-[1.15] tracking-tight text-foreground">
                  Geolocalização de empresas
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                  Entre com CPF e senha da plataforma Estagius.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="cpf" className="sr-only">
                  CPF
                </label>
                <input
                  id="cpf"
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="CPF"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  required
                  disabled={isLoading}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="sr-only">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className={cn(fieldClass, 'pr-12')}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="mt-2 h-12 w-full rounded-full text-sm font-semibold shadow-none"
                disabled={isLoading || cpf.length < 14}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </main>

          {/* Imagem */}
          <aside className="relative order-1 min-h-[240px] p-3 sm:min-h-[300px] sm:p-4 lg:order-2 lg:min-h-full lg:p-4">
            <div className="relative h-full min-h-[220px] overflow-hidden rounded-[1.5rem] sm:min-h-[280px] lg:min-h-[520px]">
              <img
                src="/login-map.png"
                alt="Mapa com empresas geolocalizadas"
                className="absolute inset-0 size-full object-cover scale-[1.02] transition-transform duration-700 ease-out hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-teal-950/55 via-transparent to-teal-950/10" />

              <div className="absolute left-4 top-4 sm:left-5 sm:top-5 animate-in fade-in-0 slide-in-from-left-2 duration-700 delay-150 fill-mode-both">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-black/45 px-3 py-2 text-xs text-white backdrop-blur-md border border-white/10 shadow-lg">
                  <Building2 className="size-3.5 shrink-0 opacity-90" />
                  <span className="font-medium">Empresas no mapa</span>
                </div>
              </div>

              <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5 flex flex-col gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-700 delay-300 fill-mode-both">
                <div className="inline-flex w-fit max-w-[90%] items-center gap-2 rounded-2xl bg-black/45 px-3 py-2 text-xs text-white backdrop-blur-md border border-white/10 shadow-lg">
                  <Navigation className="size-3.5 shrink-0 opacity-90" />
                  <span className="font-medium">Agenda e rotas do dia</span>
                </div>
                <div className="inline-flex w-fit max-w-[90%] items-center gap-2 rounded-2xl bg-black/40 px-3 py-2 text-[11px] text-white/90 backdrop-blur-md border border-white/10">
                  <MapPin className="size-3.5 shrink-0 opacity-90" />
                  <span>Geolocalização de empresas conveniadas</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
