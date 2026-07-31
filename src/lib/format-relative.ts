/** Texto relativo a partir de um ISO (ex.: lastSyncAt do freeze / carga dos dados). */
export function formatSyncAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'Atualizado agora';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Atualizado agora';

  const mins = Math.max(0, Math.floor((now - t) / 60_000));
  if (mins < 1) return 'Atualizado agora';
  if (mins === 1) return 'Atualizado há 1 min';
  if (mins < 60) return `Atualizado há ${mins} min`;

  const hours = Math.floor(mins / 60);
  if (hours === 1) return 'Atualizado há 1 h';
  if (hours < 48) return `Atualizado há ${hours} h`;

  return `Atualizado em ${new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
