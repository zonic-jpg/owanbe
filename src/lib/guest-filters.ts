/** Pure guest filtering + headline stats for the guest list page. */
export interface GuestRow {
  id: string; name: string; phone: string | null; email: string | null;
  category: string; plus_ones: number; table_no: number | null;
  rsvp_status: string; invite_status: string; sent_via: string | null;
  /** Receipt for the last successful send, and the reason the last one failed. */
  sent_at?: string | null; send_error?: string | null;
  notes: string | null;
}

export interface GuestFilters {
  category?: string;      // 'all' | vip | family | friends | colleagues | other
  inviteStatus?: string;  // 'all' | pending | sent
  rsvp?: string;          // 'all' | none | yes | no | maybe
  search?: string;
}

export function filterGuests(rows: GuestRow[], f: GuestFilters): GuestRow[] {
  const q = (f.search ?? "").trim().toLowerCase();
  return rows.filter((g) => {
    if (f.category && f.category !== "all" && g.category !== f.category) return false;
    if (f.inviteStatus && f.inviteStatus !== "all" && g.invite_status !== f.inviteStatus) return false;
    if (f.rsvp && f.rsvp !== "all" && g.rsvp_status !== f.rsvp) return false;
    if (q && !(`${g.name} ${g.phone ?? ""} ${g.email ?? ""}`.toLowerCase().includes(q))) return false;
    return true;
  });
}

export function guestStats(rows: GuestRow[]) {
  const total = rows.length;
  const headcount = rows.reduce((n, g) => n + 1 + (g.plus_ones || 0), 0);
  const vip = rows.filter((g) => g.category === "vip").length;
  const sent = rows.filter((g) => g.invite_status === "sent").length;
  const failed = rows.filter((g) => g.invite_status === "failed").length;
  const confirmed = rows.filter((g) => g.rsvp_status === "yes").length;
  // "Pending" now means genuinely not attempted — a failed send is its own
  // state, not something quietly folded back into the pending count.
  return { total, headcount, vip, sent, failed, pending: total - sent - failed, confirmed };
}
