import Papa from "papaparse";

export function parseCsv<T = Record<string, string>>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => resolve(res.data as T[]),
      error: (err) => reject(err),
    });
  });
}

export function downloadCsv(filename: string, headers: string[], sampleRow: Record<string, string>) {
  const csv = Papa.unparse({ fields: headers, data: [headers.map((h) => sampleRow[h] ?? "")] });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
