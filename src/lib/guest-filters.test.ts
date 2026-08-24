import { describe, expect, it } from "vitest";
import { filterGuests, guestStats, type GuestRow } from "./guest-filters";

const g = (o: Partial<GuestRow>): GuestRow => ({
  id: Math.random().toString(36), name: "Guest", phone: null, email: null,
  category: "other", plus_ones: 0, table_no: null,
  rsvp_status: "none", invite_status: "pending", sent_via: null, notes: null, ...o,
});

const rows = [
  g({ name: "Chief Ade", category: "vip", invite_status: "sent", sent_via: "whatsapp", rsvp_status: "yes", plus_ones: 2 }),
  g({ name: "Ngozi Obi", category: "family", phone: "+2348011111111", rsvp_status: "maybe" }),
  g({ name: "Tunde Bello", category: "friends", invite_status: "sent", sent_via: "sms" }),
  g({ name: "Aisha Musa", category: "colleagues", email: "aisha@work.ng" }),
];

describe("filterGuests", () => {
  it("category filter isolates VIPs", () => {
    const out = filterGuests(rows, { category: "vip" });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Chief Ade");
  });

  it("invite status pending excludes sent guests", () => {
    expect(filterGuests(rows, { inviteStatus: "pending" }).map((r) => r.name))
      .toEqual(["Ngozi Obi", "Aisha Musa"]);
  });

  it("rsvp filter matches exactly", () => {
    expect(filterGuests(rows, { rsvp: "maybe" })[0].name).toBe("Ngozi Obi");
  });

  it("search matches name, phone, and email case-insensitively", () => {
    expect(filterGuests(rows, { search: "chief" })[0].name).toBe("Chief Ade");
    expect(filterGuests(rows, { search: "8011111111" })[0].name).toBe("Ngozi Obi");
    expect(filterGuests(rows, { search: "AISHA@WORK" })[0].name).toBe("Aisha Musa");
  });

  it("filters combine with AND semantics", () => {
    expect(filterGuests(rows, { category: "vip", inviteStatus: "pending" })).toHaveLength(0);
  });

  it("'all' values disable a filter", () => {
    expect(filterGuests(rows, { category: "all", inviteStatus: "all", rsvp: "all" })).toHaveLength(4);
  });
});

describe("guestStats", () => {
  it("computes totals, headcount with plus-ones, and status splits", () => {
    const s = guestStats(rows);
    expect(s.total).toBe(4);
    expect(s.headcount).toBe(6); // 4 guests + 2 plus-ones
    expect(s.vip).toBe(1);
    expect(s.sent).toBe(2);
    expect(s.pending).toBe(2);
    expect(s.confirmed).toBe(1);
  });
});
