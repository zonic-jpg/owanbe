/**
 * Aso-ebi campaign intake draft persistence.
 *
 * The "describe your aso-ebi once" form on the Aso-ebi portal is pure
 * in-memory state until "Open aso-ebi campaign" is submitted, so a refresh
 * mid-fill silently discarded everything typed. Mirrors src/lib/event-draft.ts
 * (itself mirroring the Rubba plannerDraft.ts shape): a small load/save/clear
 * helper, try/catch on every access, non-fatal on quota errors, consumed via
 * a lazy useState initializer plus a useEffect that saves on change.
 *
 * Keyed per event so drafts for different events never collide.
 */

export type AsoEbiDraftForm = {
  fabric_type: string;
  colors: string;
  qty_estimate: string;
  budget_per_unit: string;
  deadline: string;
  requirements: string;
  swatch_url: string;
};

const keyFor = (eventId: string) => `owanbe_asoebi_draft_v1_${eventId}`;

export function loadAsoEbiDraft(eventId: string): Partial<AsoEbiDraftForm> | null {
  try {
    const raw = localStorage.getItem(keyFor(eventId));
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AsoEbiDraftForm>;
  } catch {
    return null;
  }
}

export function saveAsoEbiDraft(eventId: string, draft: AsoEbiDraftForm): void {
  try {
    localStorage.setItem(keyFor(eventId), JSON.stringify(draft));
  } catch {
    /* quota exceeded / private-mode storage — non-fatal, just isn't saved */
  }
}

export function clearAsoEbiDraft(eventId: string): void {
  try {
    localStorage.removeItem(keyFor(eventId));
  } catch {
    /* ignore */
  }
}
