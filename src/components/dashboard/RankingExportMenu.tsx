import { useEffect, useMemo, useState } from 'react';
import { Columns3, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  buildRankingCsv,
  columnsForExportMode,
  defaultExportColumnIds,
  downloadTextFile,
  exportRankingPdf,
  type RankingExportColumnId,
  type RankingExportRow,
} from '@/lib/ranking-export';

const PREVIEW_LIMIT = 10;

function isNumericCol(id: RankingExportColumnId): boolean {
  return (
    id === 'rank' ||
    id === 'aproveitamento' ||
    id === 'perda' ||
    id === 'enviados' ||
    id === 'contratados' ||
    id === 'reprovados' ||
    id === 'faltas' ||
    id === 'entrevista' ||
    id === 'unidades' ||
    id === 'volume'
  );
}

export function RankingExportMenu({
  mode,
  periodLabel,
  viewLabel,
  rows,
}: {
  mode: 'reputation' | 'volume';
  periodLabel: string;
  viewLabel: string;
  rows: RankingExportRow[];
}) {
  const [open, setOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const available = columnsForExportMode(mode);
  const [selected, setSelected] = useState<RankingExportColumnId[]>(() =>
    defaultExportColumnIds(mode)
  );

  useEffect(() => {
    setSelected(defaultExportColumnIds(mode));
  }, [mode]);

  const visibleColumns = useMemo(
    () => available.filter((c) => selected.includes(c.id)),
    [available, selected]
  );

  const previewRows = useMemo(() => rows.slice(0, PREVIEW_LIMIT), [rows]);

  const orderedColumnIds = useMemo(
    () => available.map((c) => c.id).filter((id) => selected.includes(id)),
    [available, selected]
  );

  const toggle = (id: RankingExportColumnId, on: boolean) => {
    setSelected((prev) => {
      if (on) return prev.includes(id) ? prev : [...prev, id];
      if (prev.length <= 1) return prev;
      return prev.filter((x) => x !== id);
    });
  };

  const selectAll = () => setSelected(available.map((c) => c.id));
  const selectNone = () => {
    const first = available[0]?.id;
    if (first) setSelected([first]);
  };

  const buildFilenameBase = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const safePeriod = periodLabel.replace(/[^\wÀ-ú]+/gi, '-').replace(/-+/g, '-');
    const safeView = viewLabel.replace(/[^\wÀ-ú]+/gi, '-').replace(/-+/g, '-');
    return `ranking-${safeView}-${safePeriod}-${stamp}`;
  };

  const handleExportCsv = () => {
    if (orderedColumnIds.length === 0 || rows.length === 0) return;
    const csv = buildRankingCsv(rows, orderedColumnIds);
    downloadTextFile(`${buildFilenameBase()}.csv`, csv, 'text/csv;charset=utf-8');
    setOpen(false);
  };

  const handleExportPdf = async () => {
    if (orderedColumnIds.length === 0 || rows.length === 0) return;
    setExportingPdf(true);
    try {
      await exportRankingPdf({
        rows,
        columnIds: orderedColumnIds,
        mode,
        viewLabel,
        periodLabel,
      });
      setOpen(false);
    } finally {
      setExportingPdf(false);
    }
  };

  const canExport = rows.length > 0 && visibleColumns.length > 0 && !exportingPdf;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="h-10 gap-1.5"
          disabled={rows.length === 0}
        >
          <Download className="size-3.5" />
          Exportar
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[min(96vw,56rem)] gap-0 overflow-hidden p-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="border-b pb-4">
          <DialogTitle>Exportar ranking</DialogTitle>
          <DialogDescription>
            {viewLabel} · {periodLabel} · escolha as colunas, confira a pré-visualização e baixe em
            CSV ou PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-6 py-4 min-h-0 flex-1 overflow-hidden">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {rows.length.toLocaleString('pt-BR')}
              </span>{' '}
              linha{rows.length === 1 ? '' : 's'} ·{' '}
              <span className="font-semibold text-foreground">{visibleColumns.length}</span> coluna
              {visibleColumns.length === 1 ? '' : 's'}
            </p>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5">
                    <Columns3 className="size-3.5" />
                    Colunas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 z-[2100]">
                  <DropdownMenuLabel>Mostrar / ocultar colunas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {available.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={selected.includes(col.id)}
                      onCheckedChange={(value) => toggle(col.id, !!value)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={selected.length === available.length}
                    onCheckedChange={(value) => (value ? selectAll() : selectNone())}
                    onSelect={(e) => e.preventDefault()}
                  >
                    Todas
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border bg-card min-h-0 flex-1">
            <ScrollArea className="h-[min(50vh,28rem)] w-full">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {visibleColumns.map((col) => (
                      <TableHead
                        key={col.id}
                        className={
                          isNumericCol(col.id)
                            ? 'text-right whitespace-nowrap'
                            : 'whitespace-nowrap'
                        }
                      >
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Math.max(visibleColumns.length, 1)}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Nenhum resultado para exportar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    previewRows.map((row) => (
                      <TableRow key={`${row.rank}-${row.empresa}`}>
                        {visibleColumns.map((col) => {
                          const value = row[col.id];
                          return (
                            <TableCell
                              key={col.id}
                              className={
                                isNumericCol(col.id)
                                  ? 'text-right tabular-nums whitespace-nowrap'
                                  : 'max-w-[14rem] truncate'
                              }
                              title={String(value ?? '')}
                            >
                              {value === '' || value == null ? '—' : String(value)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {rows.length > PREVIEW_LIMIT ? (
            <p className="text-xs text-muted-foreground">
              Pré-visualização: {PREVIEW_LIMIT} de {rows.length.toLocaleString('pt-BR')} linhas. CSV e
              PDF exportam a lista completa.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Pré-visualização da tabela que será exportada.
            </p>
          )}
        </div>

        <DialogFooter className="border-t pt-4 gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={!canExport}
              onClick={handleExportCsv}
            >
              <Download className="size-3.5" />
              Baixar CSV
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              disabled={!canExport}
              onClick={() => void handleExportPdf()}
            >
              <FileText className="size-3.5" />
              {exportingPdf ? 'Gerando PDF…' : 'Baixar PDF'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
