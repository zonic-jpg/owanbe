import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { CelebrationBar } from "@/components/CelebrationBar";
import { useLandingContent } from "@/hooks/useLandingContent";

export default function Landing() {
  const { user } = useAuth();
  const ctaTo = user ? "/dashboard" : "/auth";
  const { t } = useLandingContent();

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* ── Floating nav (Apple-style) ─────────────────────── */}
      <header className="sticky top-0 z-50 bg-neutral-800 border-b border-neutral-700 font-apple">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between text-sm text-amber-400">
          <Link to="/" className="font-apple text-base sm:text-lg font-medium tracking-tight text-amber-400 hover:text-amber-300">OwanbeX</Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
            <Link to="/vendors" className="text-amber-400 hover:text-amber-300 transition-colors">Vendors</Link>
            <Link to={ctaTo} className="text-amber-400 hover:text-amber-300 transition-colors">Plan an event</Link>
            <Link to="/dashboard" className="text-amber-400 hover:text-amber-300 transition-colors">Dashboard</Link>
            <Link to="/auth" className="text-amber-400 hover:text-amber-300 transition-colors">Sign in</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to={ctaTo}
              className="text-sm font-semibold px-4 py-2 rounded-full bg-amber-400 text-neutral-900 hover:bg-amber-300 transition-colors"
            >
              Get started
            </Link>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden -mr-2 text-amber-400 hover:text-amber-300 hover:bg-white/10"
                  aria-label="Open menu"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <nav className="mt-10 flex flex-col gap-1 text-base font-semibold text-neutral-800 font-apple">
                  <Link to="/vendors" className="px-4 py-3 rounded-lg hover:bg-neutral-100">Vendors</Link>
                  <Link to={ctaTo} className="px-4 py-3 rounded-lg hover:bg-neutral-100">Plan an event</Link>
                  <Link to="/dashboard" className="px-4 py-3 rounded-lg hover:bg-neutral-100">Dashboard</Link>
                  <Link to="/auth" className="px-4 py-3 rounded-lg hover:bg-neutral-100">Sign in</Link>
                  <Link
                    to={ctaTo}
                    className="mt-3 px-4 py-3 rounded-full bg-neutral-900 text-amber-400 text-center"
                  >
                    Get started
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ── HERO: left-aligned headline, image banner below ── */}
      <section className="pt-20 sm:pt-28 pb-16 px-6">
        <div className="max-w-6xl mx-auto animate-fade-up text-left">
          <p className="text-sm sm:text-base font-semibold text-red-500 tracking-[0.2em] uppercase">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mt-5 sm:mt-7 font-apple-tight text-[44px] sm:text-7xl lg:text-[104px] leading-[0.92] text-neutral-950 font-extrabold tracking-tight">
            {t("hero.title.line1")}<br />
            {t("hero.title.line2")}<br />
            <span className="bg-gradient-to-r from-fuchsia-600 via-red-500 to-amber-500 bg-clip-text text-transparent">
              {t("hero.title.line3")}
            </span>
          </h1>
          <p className="mt-8 sm:mt-10 font-apple text-xl sm:text-2xl text-neutral-700 max-w-3xl leading-snug font-medium">
            {t("hero.subtitle")}{" "}
            <span className="text-neutral-950 font-semibold">
              {t("hero.subtitle.bold")}
            </span>
          </p>
          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
            <Button asChild size="lg" className="w-full sm:w-64 rounded-full bg-black hover:bg-neutral-800 text-white h-14 px-8 text-base font-semibold justify-center">
              <Link to={ctaTo}>
                {user ? "Open my dashboard" : t("hero.cta.primary")} <ArrowRight className="ml-1 w-4 h-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-64 rounded-full h-14 px-8 text-base font-semibold border-neutral-300 hover:bg-neutral-50 justify-center">
              <Link to="/vendors">{t("hero.cta.secondary")}</Link>
            </Button>
          </div>
          <div
            className="mt-6 -mx-6 sm:mx-0 overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-smooth scrollbar-none [-webkit-overflow-scrolling:touch]"
            role="list"
            aria-label="Vendor categories"
          >
            <ul className="flex w-max items-center gap-2 px-6 sm:px-0">
              {[
                "Catering","DJ","Decor","Photography","MC","Security",
                "Aso-Ebi","Cake","Souvenirs","Bands","Bartenders",
                "Lighting","Venues","Make-Up","Ushers",
              ].map((c) => (
                <li
                  key={c}
                  role="listitem"
                  className="snap-start shrink-0 px-3 py-2 text-xs uppercase tracking-wide text-neutral-700 font-semibold"
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Hero image banner — sits under the headline */}
        <div className="mt-12 sm:mt-16 max-w-6xl mx-auto animate-scale-in">
          <div className="relative overflow-hidden rounded-[32px] aspect-[16/9] bg-neutral-950">
            <img
              src={t("hero.image")}
              alt="Elegant Nigerian celebration at dusk with cascading magenta and gold florals over a candlelit banquet table"
              width={1920}
              height={1080}
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        </div>
      </section>

      {/* ── Bento product cards: full-bleed colored panels ─── */}
      <section className="px-6 pb-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-6 gap-3">
          {/* Big card */}
          <article className="md:col-span-4 relative overflow-hidden rounded-[28px] bg-neutral-950 text-white aspect-[16/10] md:aspect-[2/1] group">
            <img
              src={t("card.venue.image")}
              alt="Luxury wedding venue at golden hour with cascading blush and ivory floral ceiling, gold chairs and crystal table settings"
              loading="lazy"
              decoding="async"
              sizes="(min-width: 768px) 66vw, 100vw"
              className="absolute inset-0 w-full h-full object-cover object-[center_40%] transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
            <div className="relative h-full flex flex-col justify-end p-8 sm:p-12">
              <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-300 font-semibold mb-3">{t("card.venue.eyebrow")}</p>
              <h3 className="font-apple-tight text-3xl sm:text-5xl leading-[0.95] whitespace-pre-line">
                {t("card.venue.title")}
              </h3>
              <p className="mt-4 text-white/75 text-base sm:text-lg max-w-md">
                {t("card.venue.body")}
              </p>
            </div>
          </article>

          {/* Side card */}
          <article className="md:col-span-2 relative overflow-hidden rounded-[28px] bg-amber-300 aspect-square md:aspect-auto group">
            <img
              src={t("card.vendors.image")}
              alt="Vibrant cobalt blue tablescape with jollof rice, suya, hibiscus zobo and orchids"
              loading="lazy"
              decoding="async"
              sizes="(min-width: 768px) 33vw, 100vw"
              className="absolute inset-0 w-full h-full object-cover object-[center_45%] transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="relative h-full flex flex-col justify-end p-8">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200 font-semibold mb-2">{t("card.vendors.eyebrow")}</p>
              <h3 className="font-apple-tight text-2xl sm:text-3xl text-white leading-[0.95] whitespace-pre-line">
                {t("card.vendors.title")}
              </h3>
            </div>
          </article>

          {/* Three quick cards */}
          <article className="md:col-span-2 relative overflow-hidden rounded-[28px] bg-rose-700 aspect-square p-8 flex flex-col justify-between text-white">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-rose-100 font-semibold mb-2">{t("card.budget.eyebrow")}</p>
              <h3 className="font-apple-tight text-3xl text-white leading-[0.95] whitespace-pre-line">
                {t("card.budget.title")}
              </h3>
            </div>
            <p className="text-sm text-rose-50/90 max-w-[28ch] leading-relaxed">
              {t("card.budget.body")}
            </p>
          </article>

          <article className="md:col-span-2 relative overflow-hidden rounded-[28px] bg-emerald-700 aspect-square p-8 flex flex-col justify-between text-white">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-100 font-semibold mb-2">{t("card.family.eyebrow")}</p>
              <h3 className="font-apple-tight text-3xl text-white leading-[0.95] whitespace-pre-line">
                {t("card.family.title")}
              </h3>
            </div>
            <p className="text-sm text-emerald-50/95 max-w-[28ch] leading-relaxed">
              {t("card.family.body")}
            </p>
          </article>

          <article className="md:col-span-2 relative overflow-hidden rounded-[28px] aspect-square group">
            <img
              src={t("card.joy.image")}
              alt="Joyful Nigerian wedding guests dancing in vibrant aso-ebi under warm stage lights"
              loading="lazy"
              decoding="async"
              sizes="(min-width: 768px) 33vw, 100vw"
              className="absolute inset-0 w-full h-full object-cover object-[center_30%] transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
            <div className="relative h-full flex flex-col justify-end p-8 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-yellow-300 font-semibold mb-2">{t("card.joy.eyebrow")}</p>
              <h3 className="font-apple-tight text-3xl leading-[0.95] whitespace-pre-line">
                {t("card.joy.title")}
              </h3>
            </div>
          </article>
        </div>
      </section>



      {/* ── Final CTA: minimal, confident ──────────────────── */}
      <section className="py-32 sm:py-44 px-6 text-center bg-neutral-50">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="font-apple-tight text-5xl sm:text-7xl text-neutral-950 leading-[0.95] font-extrabold">
            {t("cta.final.line1")}<br />
            <span className="bg-gradient-to-r from-red-500 to-fuchsia-600 bg-clip-text text-transparent">
              {t("cta.final.line2")}
            </span>
          </h2>
          <p className="text-2xl text-neutral-600 max-w-xl mx-auto font-medium">
            {t("cta.final.body")}
          </p>
          <div className="pt-2">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-black hover:bg-neutral-800 text-white h-14 px-10 text-base font-semibold"
            >
              <Link to={ctaTo}>{t("cta.final.button")} <ArrowRight className="ml-1 w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Vibrant celebration strip + footer ─────────────── */}
      <CelebrationBar />
      <footer className="bg-amber-800 text-amber-50/80 py-6 px-6 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="font-medium tracking-wide">{t("footer.tagline")}</div>
          <nav className="flex items-center gap-6">
            <Link to="/terms" className="text-white/70 hover:text-white transition-colors">Terms</Link>
            <Link to="/privacy" className="text-white/70 hover:text-white transition-colors">Privacy</Link>
            <Link to="/contact" className="text-white/70 hover:text-white transition-colors">Contact us</Link>
          </nav>
          <div className="text-white/60">© {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  );
}
