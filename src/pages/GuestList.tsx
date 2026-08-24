import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Check, Crown, Loader2, MessageCircle, Plus, Send, Smartphone, Trash2, Users } from "lucide-react";
import { CsvImport } from "@/components/admin/CsvImport";
import { filterGuests, guestStats, type GuestRow } from "@/lib/guest-filters";
import { GateGuard } from "@/components/GateGuard";
import type { Database } from "@/integrations/supabase/types";

type GuestInsert = Database["public"]["Tables"]["guests"]["Insert"];

const CATEGORIES = ["vip", "family", "friends", "colleagues", "other"] as const;
const CHANNELS = [
  { v: "whatsapp", l: "WhatsApp" }, { v: "sms", l: "SMS" }, { v: "email", l: "Email" },
  { v: "card", l: "Printed card" }, { v: "call", l: "Phone call" },
] as const;

const catBadge: Record<string, string> = {
  vip: "bg-amber-100 text-amber-800 border-amber-300",
  family: "bg-rose-50 text-rose-700 border-rose-200",
  friends: "bg-sky-50 text-sky-700 border-sky-200",
  colleagues: "bg-violet-50 text-violet-700 border-violet-200",
  other: "bg-muted text-muted-foreground border-border",
};

/** Contact Picker API (Chrome Android). Detected at runtime; falls back to CSV/manual. */
interface ContactsNavigator extends Navigator {
  contacts?: { select: (props: string[], opts: { multiple: boolean }) => Promise<Array<{ name?: string[]; tel?: string[]; email?: string[] }>> };
}

function GuestListInner() {
  const { id: eventId } = useParams();
  const [eventName, setEventName] = useState("");
  const [listId, setListId] = useState<string | null>(null);
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ category: "all", inviteStatus: "all", rsvp: "all", search: "" });
  const [draft, setDraft] = useState({ name: "", phone: "", email: "", category: "other", plus_ones: 0, notes: "" });
  const [addOpen, setAddOpen] = useState(false);

  const supportsContactPicker = typeof navigator !== "undefined" && !!(navigator as ContactsNavigator).contacts;

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    const { data: ev } = await supabase.from("events").select("name").eq("id", eventId).maybeSingle();
    setEventName(ev?.name ?? "Event");
    // one default list per event, created lazily
    const { data: lists } = await supabase.from("guest_lists").select("id").eq("event_id", eventId).limit(1);
    let lid = lists?.[0]?.id ?? null;
    if (!lid) {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: created, error } = await supabase.from("guest_lists")
          .insert({ event_id: eventId, owner_id: auth.user.id }).select("id").single();
        if (error) toast.error("Could not create guest list", { description: error.message });
        lid = created?.id ?? null;
      }
    }
    setListId(lid);
    if (lid) {
      const { data: gs, error } = await supabase.from("guests").select("*").eq("list_id", lid).order("created_at");
      if (error) toast.error("Failed to load guests", { description: error.message });
      setRows((gs ?? []) as GuestRow[]);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => filterGuests(rows, filters), [rows, filters]);
  const stats = useMemo(() => guestStats(rows), [rows]);

  const addGuests = async (inserts: Omit<GuestInsert, "list_id">[]) => {
    if (!listId || inserts.length === 0) return { inserted: 0, failed: inserts.length };
    const payload = inserts.map((g) => ({ ...g, list_id: listId }));
    const { data, error } = await supabase.from("guests").insert(payload).select("*");
    if (error) { toast.error("Add failed", { description: error.message }); return { inserted: 0, failed: inserts.length, errors: [error.message] }; }
    setRows((r) => [...r, ...((data ?? []) as GuestRow[])]);
    return { inserted: data?.length ?? 0, failed: 0 };
  };

  const addOne = async () => {
    if (!draft.name.trim()) return toast.error("Guest name is required");
    setBusy("add");
    const res = await addGuests([{ ...draft, plus_ones: Number(draft.plus_ones) || 0 }]);
    setBusy(null);
    if (res.inserted) { toast.success(`${draft.name} added`); setDraft({ name: "", phone: "", email: "", category: "other", plus_ones: 0, notes: "" }); setAddOpen(false); }
  };

  const pickFromContacts = async () => {
    const nav = navigator as ContactsNavigator;
    if (!nav.contacts) return;
    try {
      const picked = await nav.contacts.select(["name", "tel", "email"], { multiple: true });
      if (!picked.length) return;
      const inserts = picked.map((c) => ({
        name: c.name?.[0] ?? "Unnamed contact",
        phone: c.tel?.[0] ?? null,
        email: c.email?.[0] ?? null,
        category: "other",
      }));
      const res = await addGuests(inserts);
      if (res.inserted) toast.success(`${res.inserted} contact${res.inserted > 1 ? "s" : ""} imported from your phone`);
    } catch {
      /* user cancelled the picker — not an error */
    }
  };

  const update = async (id: string, patch: Partial<GuestRow>) => {
    setBusy(id);
    const { error } = await supabase.from("guests").update(patch).eq("id", id);
    setBusy(null);
    if (error) return toast.error("Update failed", { description: error.message });
    setRows((r) => r.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const markSent = (id: string, via: string) => update(id, { invite_status: "sent", sent_via: via });
  const markPending = (id: string) => update(id, { invite_status: "pending", sent_via: null });

  const bulkMarkSent = async (via: string) => {
    if (!selected.size) return;
    setBusy("bulk");
    const ids = [...selected];
    const { error } = await supabase.from("guests").update({ invite_status: "sent", sent_via: via }).in("id", ids);
    setBusy(null);
    if (error) return toast.error("Bulk update failed", { description: error.message });
    setRows((r) => r.map((g) => (selected.has(g.id) ? { ...g, invite_status: "sent", sent_via: via } : g)));
    toast.success(`${ids.length} marked sent via ${via}`);
    setSelected(new Set());
  };

  const remove = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from("guests").delete().eq("id", id);
    setBusy(null);
    if (error) return toast.error("Delete failed", { description: error.message });
    setRows((r) => r.filter((g) => g.id !== id));
  };

  const toggleSelect = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) { n.delete(id); } else { n.add(id); }
    return n;
  });

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to={`/events/${eventId}`} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> {eventName}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Guest list</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {supportsContactPicker && (
            <Button variant="outline" onClick={pickFromContacts}>
              <Smartphone className="w-4 h-4 mr-2" /> From phone contacts
            </Button>
          )}
          <CsvImport
            templateName="guests-template"
            headers={["name", "phone", "email", "category", "plus_ones"]}
            sampleRow={{ name: "Ada Obi", phone: "+2348012345678", email: "ada@example.com", category: "vip", plus_ones: "1" }}
            onRows={async (rows: Record<string, string>[]) => {
              const inserts = rows
                .map((r) => ({
                  name: (r.name ?? "").trim(),
                  phone: r.phone?.trim() || null,
                  email: r.email?.trim() || null,
                  category: CATEGORIES.includes((r.category ?? "").trim() as (typeof CATEGORIES)[number]) ? (r.category ?? "").trim() : "other",
                  plus_ones: Math.max(0, Math.min(20, Number(r.plus_ones) || 0)),
                }))
                .filter((r) => r.name);
              return addGuests(inserts);
            }}
          />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add guest</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add guest</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Full name *" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                  <Input placeholder="Email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c === "vip" ? "VIP" : c[0].toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min={0} max={20} placeholder="Plus ones" value={draft.plus_ones}
                    onChange={(e) => setDraft({ ...draft, plus_ones: Number(e.target.value) })} />
                </div>
                <Input placeholder="Notes (table, diet, protocol…)" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                <Button className="w-full" onClick={addOne} disabled={busy === "add"}>
                  {busy === "add" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add to list"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Headline stats — research pattern: live dashboard incl. plus-ones headcount */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Guests", value: stats.total, icon: Users },
          { label: "Headcount", value: stats.headcount, icon: Users },
          { label: "VIP", value: stats.vip, icon: Crown },
          { label: "Sent", value: stats.sent, icon: Send },
          { label: "Pending", value: stats.pending, icon: Loader2 },
          { label: "Confirmed", value: stats.confirmed, icon: Check },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><s.icon className="w-3.5 h-3.5" />{s.label}</div>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search name, phone, email…" className="max-w-xs"
          value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c === "vip" ? "VIP" : c[0].toUpperCase() + c.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.inviteStatus} onValueChange={(v) => setFilters({ ...filters, inviteStatus: v })}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.rsvp} onValueChange={(v) => setFilters({ ...filters, rsvp: v })}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All RSVPs</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="maybe">Maybe</SelectItem>
            <SelectItem value="no">No</SelectItem>
            <SelectItem value="none">No reply</SelectItem>
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" disabled={busy === "bulk"}>
                <Send className="w-4 h-4 mr-2" /> Mark {selected.size} sent via…
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {CHANNELS.map((c) => <DropdownMenuItem key={c.v} onClick={() => bulkMarkSent(c.v)}>{c.l}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Contact table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{rows.length === 0 ? "No guests yet" : "No guests match these filters"}</p>
          <p className="text-sm mt-1">{rows.length === 0 ? "Add guests manually, import a CSV, or pull from your phone contacts." : "Loosen the filters to see more."}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">+1s</TableHead>
                <TableHead>RSVP</TableHead>
                <TableHead>Invitation</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((g) => (
                <TableRow key={g.id} className={selected.has(g.id) ? "bg-muted/50" : undefined}>
                  <TableCell>
                    <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggleSelect(g.id)} className="accent-primary" aria-label={`Select ${g.name}`} />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{g.name}</p>
                    {g.notes && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{g.notes}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {g.phone && <p>{g.phone}</p>}
                    {g.email && <p className="truncate max-w-[180px]">{g.email}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={catBadge[g.category] ?? catBadge.other}>
                      {g.category === "vip" && <Crown className="w-3 h-3 mr-1" />}{g.category.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{g.plus_ones || "—"}</TableCell>
                  <TableCell>
                    <Select value={g.rsvp_status} onValueChange={(v) => update(g.id, { rsvp_status: v })}>
                      <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No reply</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="maybe">Maybe</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {g.invite_status === "sent" ? (
                      <button onClick={() => markPending(g.id)} title="Click to revert to pending">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200">
                          <Check className="w-3 h-3 mr-1" /> Sent{g.sent_via ? ` · ${g.sent_via}` : ""}
                        </Badge>
                      </button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy === g.id}>
                            <MessageCircle className="w-3 h-3 mr-1" /> Mark sent via…
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {CHANNELS.map((c) => <DropdownMenuItem key={c.v} onClick={() => markSent(g.id, c.v)}>{c.l}</DropdownMenuItem>)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(g.id)} disabled={busy === g.id} aria-label={`Remove ${g.name}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function GuestList() {
  const { id } = useParams();
  return (
    <GateGuard service="guest_list" eventId={id} featureName="Guest list management">
      <GuestListInner />
    </GateGuard>
  );
}
