// End-to-end-style flow test for the catalog selection journey.
// Simulates: tap a category → see Top-3 + grid → tap an option → verify the
// detail dialog shows the right quantity-for-guests and subtotal → close
// detail and confirm the list view returns intact.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { CategoryBrowser } from "./CategoryBrowser";

// ---- Mocks --------------------------------------------------------------
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/catalog-track", () => ({ trackProductEvent: vi.fn() }));

const drinks = [
  { id: "p1", name: "Moët & Chandon Brut Impérial", description: "Iconic French champagne.", unit_label: "per bottle", unit_price: 75_000, rating: 4.9, is_featured: true,  image_url: "https://example.com/moet.jpg",  attributes: { type: "champagne" }, category: "drinks", city: "Lagos" },
  { id: "p2", name: "Veuve Clicquot Yellow Label",     description: "Premium champagne.",       unit_label: "per bottle", unit_price: 95_000, rating: 4.95, is_featured: false, image_url: "https://example.com/veuve.jpg", attributes: {}, category: "drinks", city: "Lagos" },
  { id: "p3", name: "Star Lager Crate (24)",           description: "Crate of 24 bottles.",     unit_label: "per crate",  unit_price: 18_000, rating: 4.5,  is_featured: false, image_url: "https://example.com/star.jpg",  attributes: {}, category: "drinks", city: "Lagos" },
  { id: "p4", name: "Dom Pérignon Vintage",            description: "Luxury champagne.",        unit_label: "per bottle", unit_price: 350_000, rating: 5.0, is_featured: false, image_url: "https://example.com/dom.jpg",   attributes: {}, category: "drinks", city: "Lagos" },
];

const upsert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "catalog_products") {
        // Thenable that's also chainable on every method (last order() awaits the data).
        const result = { data: drinks, error: null };
        const builder: unknown = new Proxy(
          { then: (fn: (v: unknown) => unknown) => Promise.resolve(result).then(fn) },
          { get: (target: Record<string | symbol, unknown>, prop) => (prop in target ? target[prop] : () => builder) }
        );
        return builder;
      }
      if (table === "event_selections") {
        return { upsert: (...args: unknown[]) => upsert(...args) };
      }
      return {};
    },
  },
}));

const fmt = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
const GUESTS = 200;

describe("Catalog flow: drinks category", () => {
  beforeEach(() => upsert.mockClear());

  const renderBrowser = (onPicked = vi.fn()) =>
    render(
      <CategoryBrowser
        open
        onOpenChange={vi.fn()}
        category="drinks"
        eventId="event-123"
        guestCount={GUESTS}
        currentSelectionId={null}
        onPicked={onPicked}
      />
    );

  const findTopRow = async (productName: string) => {
    await screen.findByText("Top 3 picks");
    const table = document.querySelector("table") as HTMLTableElement;
    expect(table).toBeTruthy();
    const buttons = within(table).getAllByRole("button");
    const nameBtn = buttons.find((b) => b.textContent === productName)!;
    expect(nameBtn).toBeTruthy();
    return { row: nameBtn.closest("tr") as HTMLElement, table, nameBtn };
  };

  it("renders the Top-3 table with correct per-guest qty × unit price", async () => {
    renderBrowser();
    // Editor's pick = featured Moët. qty = max(12, 200/10) = 20 bottles.
    const editor = await findTopRow("Moët & Chandon Brut Impérial");
    expect(within(editor.row).getByText(/20 ×/)).toBeInTheDocument();
    expect(within(editor.row).getByText(fmt(20 * 75_000))).toBeInTheDocument();
    expect(within(editor.row).getByText("Editor's pick")).toBeInTheDocument();

    // Best value = lowest subtotal among the rest. Star Lager: max(2, round(200/60)=3)=3 crates × 18k = 54k.
    const value = await findTopRow("Star Lager Crate (24)");
    expect(within(value.row).getByText(/3 ×/)).toBeInTheDocument();
    expect(within(value.row).getByText(fmt(3 * 18_000))).toBeInTheDocument();
    expect(within(value.row).getByText("Best value")).toBeInTheDocument();

    // Premium = highest remaining subtotal. Dom Pérignon: 20 × 350k = 7M.
    const premium = await findTopRow("Dom Pérignon Vintage");
    expect(within(premium.row).getByText(fmt(20 * 350_000))).toBeInTheDocument();
    expect(within(premium.row).getByText("Premium")).toBeInTheDocument();
  });

  it("opens the option detail dialog with matching qty + subtotal, then closes back to the list", async () => {
    renderBrowser();
    await screen.findByText("Top 3 picks");
    // Veuve isn't in Top-3 (Editor=Moët, Value=Star, Premium=Dom), so clicking
    // its grid card opens the detail page from the full list.
    fireEvent.click(screen.getByText("Veuve Clicquot Yellow Label"));

    // Detail dialog shows computed quantity for guest count and subtotal.
    // (Both the Sheet and Dialog have role="dialog"; locate by the title text.)
    const dialogTitle = await screen.findByText("Veuve Clicquot Yellow Label", { selector: "h2, [role='heading']" });
    const dialog = dialogTitle.closest("[role='dialog']") as HTMLElement;
    expect(within(dialog).getByText(`Quantity for ${GUESTS} guests`)).toBeInTheDocument();
    expect(within(dialog).getByText("20")).toBeInTheDocument(); // qty
    expect(within(dialog).getByText(fmt(20 * 95_000))).toBeInTheDocument(); // subtotal

    // Close the dialog via the Radix close button.
    fireEvent.click(within(dialog).getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByText(`Quantity for ${GUESTS} guests`)).not.toBeInTheDocument());

    // Back-navigation: list view + Top-3 still present.
    expect(screen.getByText("Top 3 picks")).toBeInTheDocument();
    await findTopRow("Moët & Chandon Brut Impérial");
  });

  it("selecting an option upserts the choice and notifies the parent so totals refresh", async () => {
    const onPicked = vi.fn();
    renderBrowser(onPicked);
    const value = await findTopRow("Star Lager Crate (24)");
    fireEvent.click(within(value.row).getByRole("button", { name: /select/i }));

    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "event-123",
        category: "drinks",
        product_id: "p3",
        qty: 3,
        locked_unit_price: 18_000,
      }),
      { onConflict: "event_id,category" }
    );
    await waitFor(() => expect(onPicked).toHaveBeenCalled());
    // Row flips to "Selected" — confirms instant visual update.
    await waitFor(() => expect(within(value.row).getByText("Selected")).toBeInTheDocument());
  });
});
