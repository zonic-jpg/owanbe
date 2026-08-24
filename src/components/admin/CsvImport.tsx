import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Download, Loader2 } from "lucide-react";
import { parseCsv, downloadCsv } from "@/lib/csv";
import { toast } from "sonner";

export function CsvImport<T extends Record<string, unknown>>({
  templateName,
  headers,
  sampleRow,
  onRows,
}: {
  templateName: string;
  headers: string[];
  sampleRow: Record<string, string>;
  onRows: (rows: T[]) => Promise<{ inserted: number; failed: number; errors?: string[] }>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const rows = await parseCsv<T>(file);
      if (!rows.length) throw new Error("CSV is empty");
      const res = await onRows(rows);
      toast.success(`Imported ${res.inserted} rows`, {
        description: res.failed > 0 ? `${res.failed} rows failed. ${res.errors?.[0] ?? ""}` : undefined,
      });
    } catch (e) {
      toast.error("Import failed", { description: e?.message ?? String(e) });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        ref={ref}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
      />
      <Button variant="outline" size="sm" onClick={() => downloadCsv(templateName, headers, sampleRow)}>
        <Download className="w-4 h-4 mr-1" /> Template
      </Button>
      <Button size="sm" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
        Import CSV
      </Button>
    </div>
  );
}
