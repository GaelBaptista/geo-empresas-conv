/** Exportação CSV do ranking (colunas escolhidas pelo usuário). */

export type RankingExportColumnId =
  | 'rank'
  | 'empresa'
  | 'recrutador'
  | 'aproveitamento'
  | 'perda'
  | 'classificacao'
  | 'enviados'
  | 'contratados'
  | 'reprovados'
  | 'faltas'
  | 'entrevista'
  | 'unidades'
  | 'volume';

export type RankingExportColumn = {
  id: RankingExportColumnId;
  label: string;
  /** Só na aba de reputação */
  reputationOnly?: boolean;
  /** Só nas abas de volume */
  volumeOnly?: boolean;
};

export const RANKING_EXPORT_COLUMNS: RankingExportColumn[] = [
  { id: 'rank', label: '#' },
  { id: 'empresa', label: 'Empresa / grupo' },
  { id: 'recrutador', label: 'Recrutador' },
  { id: 'aproveitamento', label: 'Aproveitamento %', reputationOnly: true },
  { id: 'perda', label: 'Perda %', reputationOnly: true },
  { id: 'classificacao', label: 'Classificação', reputationOnly: true },
  { id: 'enviados', label: 'Enviados', reputationOnly: true },
  { id: 'contratados', label: 'Contratados', reputationOnly: true },
  { id: 'reprovados', label: 'Reprovados', reputationOnly: true },
  { id: 'faltas', label: 'Faltas', reputationOnly: true },
  { id: 'entrevista', label: 'Em entrevista', reputationOnly: true },
  { id: 'unidades', label: 'Unidades (CNPJs)' },
  { id: 'volume', label: 'Volume', volumeOnly: true },
];

export type RankingExportRow = {
  rank: number;
  empresa: string;
  recrutador: string;
  aproveitamento: string;
  perda: string;
  classificacao: string;
  enviados: number | string;
  contratados: number | string;
  reprovados: number | string;
  faltas: number | string;
  entrevista: number | string;
  unidades: number | string;
  volume: number | string;
};

function csvEscape(value: string | number): string {
  const raw = String(value ?? '');
  if (/[",\n\r;]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function buildRankingCsv(
  rows: RankingExportRow[],
  columnIds: RankingExportColumnId[]
): string {
  const cols = RANKING_EXPORT_COLUMNS.filter((c) => columnIds.includes(c.id));
  const header = cols.map((c) => csvEscape(c.label)).join(';');
  const lines = rows.map((row) =>
    cols.map((c) => csvEscape(row[c.id])).join(';')
  );
  // BOM para Excel abrir UTF-8 corretamente
  return `\uFEFF${[header, ...lines].join('\r\n')}`;
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function defaultExportColumnIds(mode: 'reputation' | 'volume'): RankingExportColumnId[] {
  return RANKING_EXPORT_COLUMNS.filter((c) => {
    if (mode === 'reputation' && c.volumeOnly) return false;
    if (mode === 'volume' && c.reputationOnly) return false;
    return true;
  }).map((c) => c.id);
}

export function columnsForExportMode(mode: 'reputation' | 'volume'): RankingExportColumn[] {
  return RANKING_EXPORT_COLUMNS.filter((c) => {
    if (mode === 'reputation' && c.volumeOnly) return false;
    if (mode === 'volume' && c.reputationOnly) return false;
    return true;
  });
}

export function resolveExportColumns(
  mode: 'reputation' | 'volume',
  columnIds: RankingExportColumnId[]
): RankingExportColumn[] {
  const available = columnsForExportMode(mode);
  return available.filter((c) => columnIds.includes(c.id));
}

function slugifyFilename(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 50)
      .toLowerCase() || 'ranking'
  );
}

/** Exporta o ranking em PDF (colunas selecionadas) com pdfmake. */
export async function exportRankingPdf(options: {
  rows: RankingExportRow[];
  columnIds: RankingExportColumnId[];
  mode: 'reputation' | 'volume';
  viewLabel: string;
  periodLabel: string;
}): Promise<void> {
  const cols = resolveExportColumns(options.mode, options.columnIds);
  if (cols.length === 0 || options.rows.length === 0) return;

  const [{ default: pdfMake }, pdfFonts] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);

  pdfMake.addVirtualFileSystem(pdfFonts.default ?? pdfFonts);

  const headerRow = cols.map((c) => ({
    text: c.label,
    style: 'tableHeader' as const,
    alignment:
      c.id === 'empresa' || c.id === 'recrutador' || c.id === 'classificacao'
        ? ('left' as const)
        : ('right' as const),
  }));

  const bodyRows = options.rows.map((row) =>
    cols.map((c) => {
      const raw = row[c.id];
      const text = raw === '' || raw == null ? '—' : String(raw);
      return {
        text,
        alignment:
          c.id === 'empresa' || c.id === 'recrutador' || c.id === 'classificacao'
            ? ('left' as const)
            : ('right' as const),
        noWrap: c.id !== 'empresa' && c.id !== 'recrutador',
      };
    })
  );

  const generatedAt = new Date().toLocaleString('pt-BR');
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `ranking-${slugifyFilename(options.viewLabel)}-${slugifyFilename(options.periodLabel)}-${stamp}.pdf`;

  const doc = {
    pageSize: 'A4' as const,
    pageOrientation: 'landscape' as const,
    pageMargins: [28, 36, 28, 36] as [number, number, number, number],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8,
      color: '#0f172a',
    },
    styles: {
      title: { fontSize: 14, bold: true, color: '#0f172a' },
      subtitle: { fontSize: 9, color: '#64748b' },
      tableHeader: { bold: true, fontSize: 8, color: '#0f172a', fillColor: '#f1f5f9' },
      footer: { fontSize: 8, color: '#94a3b8' },
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `Gerado em ${generatedAt} · Página ${currentPage} de ${pageCount} · Gestão de Visitas`,
      style: 'footer',
      margin: [28, 0, 28, 0] as [number, number, number, number],
      alignment: 'center' as const,
    }),
    content: [
      { text: 'Ranking das empresas', style: 'title' },
      {
        text: `${options.viewLabel} · ${options.periodLabel} · ${options.rows.length} registro(s)`,
        style: 'subtitle',
        margin: [0, 4, 0, 12] as [number, number, number, number],
      },
      {
        table: {
          headerRows: 1,
          widths: cols.map((c) => {
            if (c.id === 'empresa') return '*';
            if (c.id === 'recrutador') return 'auto';
            if (c.id === 'rank') return 24;
            return 'auto';
          }),
          body: [headerRow, ...bodyRows],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f1f5f9' : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#e2e8f0',
          vLineColor: () => '#e2e8f0',
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    ],
  };

  pdfMake.createPdf(doc).download(filename);
}

