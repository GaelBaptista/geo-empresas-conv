/** Cliente do congelamento de entrevistas (Netlify Blobs via Function). */

export type FreezeOutcome =
  | 'contratado'
  | 'reprovado_empresa'
  | 'nao_compareceu_empresa'
  | null;

export type FreezeEntry = {
  candidatoId: number;
  jobPostingId: number;
  cnpj: string;
  companyName: string;
  fullName?: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  sourceStatus?: string | null;
  outcome: FreezeOutcome;
  outcomeAt: string | null;
  updatedAtApi?: string | null;
};

export type FreezePayload = {
  ok: boolean;
  version?: number;
  lastSyncAt?: string | null;
  updatedAt?: string | null;
  entryCount?: number;
  totals?: {
    total: number;
    emFunil: number;
    contratados: number;
    reprovados: number;
    naoCompareceu: number;
  };
  entries?: FreezeEntry[];
  error?: string;
};

function freezeUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/.netlify/functions/entrevista-freeze`;
  }
  return '/.netlify/functions/entrevista-freeze';
}

/** Lê o baú acumulado. Em local (Vite sem Netlify Dev) retorna null. */
export async function fetchEntrevistaFreeze(): Promise<FreezePayload | null> {
  try {
    const res = await fetch(freezeUrl(), { method: 'GET' });
    if (!res.ok) return null;
    const data = (await res.json()) as FreezePayload;
    if (!data?.ok) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Dispara sync com debounce no servidor (~5 min).
 * Fire-and-forget: não bloqueia a UI se falhar (ex.: dev local).
 */
export function triggerEntrevistaFreezeSync(): void {
  void fetch(freezeUrl(), { method: 'POST' }).catch(() => undefined);
}
