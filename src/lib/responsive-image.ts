// Auto-size an uploaded image for different device types, entirely client-side.
// Returns Mobile / Tablet / Desktop renditions; in production these upload to
// storage and feed a responsive <img srcset>.

export type SizedImage = { label: string; width: number; height: number; dataUrl: string; kb: number };

const PRESETS = [
  { label: "Mobile", w: 480 },
  { label: "Tablet", w: 1024 },
  { label: "Desktop", w: 1600 },
];

const readFile = (file: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

export async function resizeForDevices(file: File): Promise<SizedImage[]> {
  const dataUrl = await readFile(file);
  const img = await loadImage(dataUrl);
  return PRESETS.map(({ label, w }) => {
    const scale = Math.min(1, w / img.width);
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    const out = canvas.toDataURL("image/jpeg", 0.82);
    return { label, width, height, dataUrl: out, kb: Math.round((out.length * 0.75) / 1024) };
  });
}
