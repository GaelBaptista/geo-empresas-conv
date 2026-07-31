import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { getCompanyDisplayName } from '@/lib/company';
import type { CompanyMinivagasExtras } from '@/services/minivagasApi';
import type { Company } from '@/types';

function pct(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

function slugifyFilename(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60)
      .toLowerCase() || 'empresa'
  );
}

function field(label: string, value: string): Content {
  return {
    stack: [
      { text: label, style: 'label' },
      { text: value || '—', style: 'value' },
    ],
    margin: [0, 0, 0, 8] as [number, number, number, number],
  };
}

function buildDocDefinition(
  company: Company,
  minivagasExtras?: CompanyMinivagasExtras | null
): TDocumentDefinitions {
  const name = getCompanyDisplayName(company);
  const reputation = minivagasExtras?.reputation;
  const showMetrics = Boolean(reputation && reputation.enviados > 0);

  const content: Content[] = [
    {
      columns: [
        {
          text: company.neighborhoodName || '—',
          style: 'chip',
          width: 'auto',
        },
        {
          text: company.status || '—',
          style: 'chip',
          width: 'auto',
          margin: [6, 0, 0, 0] as [number, number, number, number],
        },
      ],
      columnGap: 0,
      margin: [0, 0, 0, 8] as [number, number, number, number],
    },
    { text: name, style: 'title' },
    {
      text: company.tradeName
        ? `Razão social: ${company.name}`
        : [company.city, company.groupName].filter(Boolean).join(' · ') ||
          'Empresa conveniada',
      style: 'subtitle',
      margin: [0, 0, 0, 14] as [number, number, number, number],
    },
    {
      stack: [
        { text: 'DADOS DO CONVÊNIO', style: 'section' },
        {
          columns: [
            field('CNPJ', company.cnpj || 'Não informado'),
            field('Início do convênio', company.convenioDate || '—'),
          ],
          columnGap: 16,
        },
        field('Endereço', company.address || '—'),
        ...(company.groupName ? [field('Grupo', company.groupName)] : []),
        field('Telefone', company.phone || '—'),
        field('E-mail', company.email || '—'),
        {
          columns: [
            field('Estagiários ativos', String(company.activeTrainees ?? 0)),
            field('Inativos', String(company.inactiveTrainees ?? 0)),
          ],
          columnGap: 16,
        },
      ],
      style: 'card',
      margin: [0, 0, 0, 12] as [number, number, number, number],
    },
  ];

  if (showMetrics && reputation) {
    content.push({
      stack: [
        {
          columns: [
            {
              stack: [
                { text: 'MÉTRICAS', style: 'section' },
                {
                  text: 'Resultado dos candidatos enviados para entrevista neste grupo.',
                  style: 'muted',
                },
              ],
              width: '*',
            },
            {
              stack: [
                {
                  text: reputation.score != null ? String(reputation.score) : '—',
                  style: 'score',
                  alignment: 'right',
                },
                { text: 'nota / 100', style: 'muted', alignment: 'right' },
              ],
              width: 90,
            },
          ],
        },
        {
          table: {
            widths: ['*', '*', '*', '*', '*'],
            body: [
              [
                { text: 'Candidatos', style: 'metricLabel' },
                { text: 'Contratados', style: 'metricLabel' },
                { text: 'Reprovados', style: 'metricLabel' },
                { text: 'Faltas', style: 'metricLabel' },
                { text: 'Em entrevista', style: 'metricLabel' },
              ],
              [
                { text: String(reputation.enviados), style: 'metricValue' },
                { text: String(reputation.contratados), style: 'metricValue' },
                { text: String(reputation.reprovados), style: 'metricValue' },
                { text: String(reputation.naoCompareceu), style: 'metricValue' },
                { text: String(reputation.emFunil), style: 'metricValue' },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#e2e8f0',
            vLineColor: () => '#e2e8f0',
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
          margin: [0, 10, 0, 0] as [number, number, number, number],
        },
        ...(reputation.decididos > 0
          ? ([
              {
                text: `Contratou ${pct(reputation.hireRate)} · Reprovou ${pct(reputation.rejectRate)} · Faltou ${pct(reputation.noShowRate)}`,
                style: 'muted',
                margin: [0, 10, 0, 0] as [number, number, number, number],
              },
              {
                text: `${reputation.decididos} com resultado · ${reputation.emFunil} ainda em entrevista`,
                style: 'muted',
                margin: [0, 4, 0, 0] as [number, number, number, number],
              },
            ] as Content[])
          : []),
      ],
      style: 'card',
      margin: [0, 0, 0, 12] as [number, number, number, number],
    });
  }

  if (minivagasExtras?.observacoes) {
    content.push({
      stack: [
        { text: 'OBSERVAÇÕES MINIVAGAS', style: 'section' },
        { text: minivagasExtras.observacoes, style: 'value' },
      ],
      style: 'card',
      margin: [0, 0, 0, 12] as [number, number, number, number],
    });
  }

  content.push({
    text: `Gerado em ${new Date().toLocaleString('pt-BR')} · Gestão de Visitas`,
    style: 'footer',
    margin: [0, 8, 0, 0] as [number, number, number, number],
  });

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: '#0f172a',
    },
    styles: {
      title: { fontSize: 18, bold: true, color: '#0f172a' },
      subtitle: { fontSize: 10, color: '#64748b' },
      section: {
        fontSize: 10,
        bold: true,
        color: '#334155',
        margin: [0, 0, 0, 8],
      },
      label: { fontSize: 9, color: '#64748b', margin: [0, 0, 0, 2] },
      value: { fontSize: 10, bold: true },
      muted: { fontSize: 9, color: '#64748b' },
      chip: {
        fontSize: 9,
        color: '#334155',
        background: '#f1f5f9',
      },
      score: { fontSize: 22, bold: true },
      metricLabel: { fontSize: 8, color: '#64748b' },
      metricValue: { fontSize: 13, bold: true },
      footer: { fontSize: 8, color: '#94a3b8' },
      card: {},
    },
    content,
  };
}

/**
 * Exporta a ficha em PDF com pdfmake (download direto).
 * Sem agenda. Reputação → "Métricas", sem Excelente/Crítica/Regular.
 */
export async function exportCompanyDetailPdf(
  company: Company,
  minivagasExtras?: CompanyMinivagasExtras | null
): Promise<void> {
  const [{ default: pdfMake }, pdfFonts] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);

  pdfMake.addVirtualFileSystem(pdfFonts.default ?? pdfFonts);

  const doc = buildDocDefinition(company, minivagasExtras);
  const filename = `ficha-${slugifyFilename(getCompanyDisplayName(company))}.pdf`;
  pdfMake.createPdf(doc).download(filename);
}
