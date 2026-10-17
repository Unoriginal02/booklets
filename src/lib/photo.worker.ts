/// <reference lib="webworker" />
// Decodifica una foto (respetando EXIF) y genera vista previa y miniatura sin bloquear la interfaz.

async function resized(bmp: ImageBitmap, max: number, quality: number): Promise<Blob> {
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}

self.onmessage = async (e: MessageEvent<{ id: number; blob: Blob }>) => {
  const { id, blob } = e.data;
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const preview = await resized(bmp, 1600, 0.85);
    const thumb = await resized(bmp, 360, 0.8);
    const res = { id, ok: true, w: bmp.width, h: bmp.height, preview, thumb };
    bmp.close();
    self.postMessage(res);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};
