import { LocateFixed, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LocationRequiredGateProps {
  open: boolean;
  isRequesting: boolean;
  onAllow: () => void;
  onUseFortaleza: () => void;
}

/**
 * O usuário precisa clicar em Permitir (gesto) para o navegador abrir o prompt.
 * Sem botão, muita gente fica presa só com o texto.
 */
export function LocationRequiredGate({
  open,
  isRequesting,
  onAllow,
  onUseFortaleza,
}: LocationRequiredGateProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md p-6 gap-5 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3 text-left">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <MapPin className="size-6" />
          </div>
          <DialogTitle className="text-xl">Qual cidade você está?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed space-y-2">
            <span className="block">
              Usamos a localização só para descobrir a <strong>cidade</strong> e já abrir o mapa
              nela — não precisamos da rua exata.
            </span>
            <span className="block text-muted-foreground">
              Se preferir não permitir, seguimos com <strong>Fortaleza</strong>.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            className="w-full h-12 text-base"
            disabled={isRequesting}
            onClick={onAllow}
          >
            {isRequesting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LocateFixed className="size-4" />
            )}
            {isRequesting ? 'Aguardando o navegador…' : 'Permitir e detectar cidade'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={isRequesting}
            onClick={onUseFortaleza}
          >
            Continuar com Fortaleza
          </Button>
        </div>

        {isRequesting && (
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Se aparecer uma janela do navegador, toque em <strong>Permitir</strong>.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
