import { useState } from "react";
import { siblingZonicApps } from "@/lib/zonicLinks";

// Defaults; in production these load from the content the admin Studio edits.
const DEFAULT = {
  privacy:
    "Owanbe Planner respects your privacy. We collect only what's needed to plan your events, connect you with vendors and process bookings, never sell your personal data, and use regulated payment providers. You can request deletion of your data at any time.",
  contact:
    "Owanbe Planner (a ZonicMe company)\nFloor M2, Transcorp Hilton, Abuja, Nigeria\n\nSupport: hello@owanbe.app\nVendors: vendors@owanbe.app",
  faqs: [
    { q: "How do I plan an event?", a: "Create an event, set your budget and date, then add vendors, guests and aso-ebi — Owanbe keeps everything in one timeline." },
    { q: "How are vendors vetted?", a: "Vendors apply and are reviewed by our team before appearing in the directory; you can shortlist and compare before booking." },
    { q: "Can I manage guests and RSVPs?", a: "Yes — add your guest list, send invites and track RSVPs from your event dashboard." },
  ],
};

type Key = "privacy" | "faqs" | "contact";
const TITLES: Record<Key, string> = { privacy: "Privacy", faqs: "Frequently asked questions", contact: "Contact us" };
const SIBLINGS = siblingZonicApps("owanbex");

export default function SiteFooter({ content = DEFAULT }: { content?: typeof DEFAULT }) {
  const [open, setOpen] = useState<Key | null>(null);
  const [faq, setFaq] = useState<number | null>(0);
  return (
    <>
      <nav className="flex flex-col items-center gap-4 border-t border-border bg-background px-4 py-6">
        <div className="flex justify-center gap-9 flex-wrap">
          {(["privacy", "faqs", "contact"] as Key[]).map((k) => (
            <button key={k} onClick={() => setOpen(k)} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
              {k === "faqs" ? "FAQ" : TITLES[k]}
            </button>
          ))}
        </div>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground/70 mb-2">Other ZonicMe products</p>
          <div className="flex justify-center gap-4 flex-wrap">
            {SIBLINGS.map((a) => (
              <a key={a.id} href={a.href} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                {a.label}
              </a>
            ))}
          </div>
        </div>
      </nav>
      {open && <div className="fixed inset-0 z-[88] bg-black/40" onClick={() => setOpen(null)} />}
      <section className={`fixed inset-x-0 bottom-0 z-[92] max-h-[82vh] overflow-auto rounded-t-2xl border-t border-border bg-background shadow-2xl transition-transform duration-300 ${open ? "translate-y-0" : "translate-y-full"}`}>
        <button onClick={() => setOpen(null)} className="absolute right-5 top-4 text-2xl text-muted-foreground">×</button>
        <div className="mx-auto max-w-3xl px-6 pb-12 pt-8">
          <h2 className="mb-5 text-2xl font-extrabold tracking-tight">{open ? TITLES[open] : ""}</h2>
          {open === "faqs" ? (
            <div>
              {content.faqs.map((f, i) => (
                <div key={i} className="border-b border-border">
                  <button onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-bold">
                    {f.q}<span className="text-xl text-muted-foreground">{faq === i ? "−" : "+"}</span>
                  </button>
                  {faq === i && <p className="pb-4 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>}
                </div>
              ))}
            </div>
          ) : open ? (
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/80">{content[open]}</div>
          ) : null}
        </div>
      </section>
    </>
  );
}
