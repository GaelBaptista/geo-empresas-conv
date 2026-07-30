import type { Config } from '@netlify/functions';
import { syncEntrevistaFreeze } from './_shared/freeze.mjs';

/**
 * Cron UTC a cada 20 min — congela entrevistas e atualiza desfechos no Blob do site.
 * Não é invocável por URL em produção; use "Run now" no painel Netlify se precisar.
 */
export default async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await syncEntrevistaFreeze();
    console.log('sync-entrevista-freeze ok', {
      next_run: body?.next_run,
      ...result,
    });
  } catch (error) {
    console.error('sync-entrevista-freeze failed', error);
    throw error;
  }
};

export const config: Config = {
  schedule: '*/20 * * * *',
};
