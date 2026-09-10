/**
 * New-event wizard draft persistence.
 *
 * EventNew is a 4-step wizard that only writes to the database on final
 * submit — unlike GuestList/BrandOnboarding, which persist each step to the
 * DB as the user goes, so a refresh never loses their place. There is
 * nothing to save server-side here until submit, so the draft (form fields,
 * colour picks, and current step) is kept in localStorage instead, mirroring
 * the sibling apps' small load/save/clear helper shape: try/catch on every
 * access, non-fatal on quota errors, consumed via a lazy useState initializer
 * plus a useEffect that saves on change.
 */

export type EventDraftForm = {
  name: string;
  type: string;
  city: string;
  event_date: string;
  guest_count: number;
  budget_min: number;
  budget_max: number;
  vibe: string;
  notes: string;
  cover_url: string;
};

export type EventDraft = {
  step: number;
  form: EventDraftForm;
  colors: string[];
};

const DRAFT_KEY = "owanbe_event_draft_v1";

export function loadEventDraft(): Partial<EventDraft> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<EventDraft>;
  } catch {
    return null;
  }
}

export function saveEventDraft(draft: EventDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* quota exceeded / private-mode storage — non-fatal, just isn't saved */
  }
}

export function clearEventDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
