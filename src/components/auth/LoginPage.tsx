import { useState } from 'react';
import { Loader2, MapPin, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { TooltipProvider } from '@/components/ui/tooltip';

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
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900 via-cyan-900 to-slate-950 dark:from-slate-950 dark:via-teal-950 dark:to-black" />
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_right,rgba(45_212_191/0.35),transparent_55%)]" />
        <div className="absolute -bottom-24 -left-16 size-80 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle className="bg-card/90 border-white/20" />
        </div>

        <Card className="relative w-full max-w-md border-border/40 shadow-2xl shadow-black/30 bg-card/95 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center pb-2">
            <div className="mx-auto size-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-700 flex items-center justify-center text-white shadow-lg shadow-teal-700/30">
              <MapPin className="size-7" />
            </div>
            <div>
              <CardTitle className="font-display text-2xl tracking-tight">
                Visitas Fortaleza
              </CardTitle>
              <CardDescription className="mt-1.5">
                Entre com CPF e senha da plataforma Estagius
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading || cpf.length < 14}>
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <Lock />
                    Entrar
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
