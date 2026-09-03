import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Download, Loader2 } from "lucide-react";
import { parseCsv, downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import { publicError, publicMessage } from "@/lib/publicMessage";

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
      if (!rows.length) throw new Error("That file has no rows in it.");
      const res = await onRows(rows);
      if (res.inserted === 0 && res.failed > 0) {
        toast.error("Nothing was imported", {
          description: publicError(res.errors?.[0], `All ${res.failed} rows were rejected. Check the template and try again.`),
        });
      } else {
        toast.success(`Imported ${res.inserted} row${res.inserted === 1 ? "" : "s"}`, {
          description: res.failed > 0
            ? `${res.failed} row${res.failed === 1 ? "" : "s"} skipped. ${publicMessage(res.errors?.[0]) || "Check those rows against the template."}`
            : `Finished at ${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.`,
        });
      }
    } catch (e) {
      toast.error("Import failed", { description: publicError(e, "We couldn't read that file. Please check it's a CSV and try again.") });
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
