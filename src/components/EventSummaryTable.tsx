import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prettyCategory } from "@/lib/vendor-categories";

const fmt = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

export type SelectionRow = {
  id: string;
  category: string;
  qty: number;
  locked_unit_price: number;
  catalog_products: { name: string; unit_label: string; image_url: string | null } | null;
};

export function EventSummaryTable({ selections, budgetMax, budgetMode }: { selections: SelectionRow[]; budgetMax?: number | null; budgetMode?: string | null }) {
  const total = selections.reduce((s, r) => s + r.qty * r.locked_unit_price, 0);
  const avg = selections.length ? Math.round(total / selections.length) : 0;
  const overBudget = budgetMode === "fixed" && budgetMax ? total > budgetMax : false;
  const pct = budgetMax ? Math.min(999, Math.round((total / budgetMax) * 100)) : null;

  return (
    <Card className="overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b bg-muted/40">
        <div>
          <h2 className="font-display text-xl">Event summary</h2>
          <p className="text-xs text-muted-foreground">{selections.length} categories chosen</p>
        </div>
        {overBudget && <Badge variant="destructive">Over budget</Badge>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b">
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Pick</th>
              <th className="p-3 font-medium text-right">Unit</th>
              <th className="p-3 font-medium text-right">Qty</th>
              <th className="p-3 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {selections.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No categories picked yet — tap a category card above to start building.</td></tr>
            )}
            {selections.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-3 capitalize">{prettyCategory(r.category)}</td>
                <td className="p-3"><div className="font-medium truncate max-w-[200px]">{r.catalog_products?.name ?? "—"}</div><div className="text-xs text-muted-foreground">{r.catalog_products?.unit_label}</div></td>
                <td className="p-3 text-right">{fmt(r.locked_unit_price)}</td>
                <td className="p-3 text-right">{r.qty}</td>
                <td className="p-3 text-right font-medium">{fmt(r.qty * r.locked_unit_price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/40 font-medium">
            <tr><td colSpan={4} className="p-3 text-right">Average per category</td><td className="p-3 text-right">{fmt(avg)}</td></tr>
            <tr className="border-t"><td colSpan={4} className="p-3 text-right text-base">Total</td><td className="p-3 text-right text-base text-primary font-display">{fmt(total)}</td></tr>
            {pct !== null && (
              <tr><td colSpan={5} className="p-3"><div className="flex items-center justify-between text-xs mb-1"><span>Budget used</span><span className={overBudget ? "text-destructive" : "text-muted-foreground"}>{pct}% of {fmt(budgetMax!)}</span></div><div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full ${overBudget ? "bg-destructive" : "bg-gradient-gold"}`} style={{ width: `${Math.min(100, pct)}%` }} /></div></td></tr>
            )}
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
