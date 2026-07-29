import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type SearchableOption = {
  value: string;
  label: string;
  hint?: string;
};

interface SearchableSelectProps {
  value: string;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SearchableSelect({
  value,
  options,
  placeholder = 'Selecionar',
  searchPlaceholder = 'Buscar...',
  emptyText = 'Nenhum resultado',
  onChange,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.hint?.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between font-normal h-9 px-3"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate text-left">
          {selected ? (
            <>
              {selected.label}
              {selected.hint ? (
                <span className="text-muted-foreground"> · {selected.hint}</span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
      </Button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[1100] rounded-lg border bg-popover text-popover-foreground shadow-lg overflow-hidden">
          <div className="relative p-2 border-b">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground text-center">{emptyText}</p>
            ) : (
              filtered.map((option) => {
                const isActive = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm cursor-pointer',
                      isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                    )}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <Check className={cn('size-3.5 shrink-0', isActive ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.hint && (
                      <span className="text-[11px] text-muted-foreground shrink-0">{option.hint}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
