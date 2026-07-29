/** Vínculos manuais agenda → empresa (localStorage). */
const STORAGE_KEY = 'SCHEDULE_MANUAL_MATCHES_V1';

export type ManualMatches = Record<string, string>; // scheduleId -> companyId

export function loadManualMatches(): ManualMatches {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ManualMatches;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveManualMatches(matches: ManualMatches) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  } catch {
    /* ignore */
  }
}

export function setManualMatch(scheduleId: string, companyId: string): ManualMatches {
  const next = { ...loadManualMatches(), [scheduleId]: companyId };
  saveManualMatches(next);
  return next;
}

export function clearManualMatch(scheduleId: string): ManualMatches {
  const next = { ...loadManualMatches() };
  delete next[scheduleId];
  saveManualMatches(next);
  return next;
}
