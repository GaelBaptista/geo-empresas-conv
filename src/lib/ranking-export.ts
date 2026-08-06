/** Exportação CSV do ranking (colunas escolhidas pelo usuário). */

export type RankingExportColumnId =
  | 'rank'
  | 'empresa'
  | 'recrutador'
  | 'aproveitamento'
  | 'contratacao'
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
  { id: 'contratacao', label: 'Contratação %', reputationOnly: true },
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
  contratacao: string;
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
