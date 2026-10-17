import type { PdfRequest, PdfResponse } from './pdf.worker';

export function runPdf(req: PdfRequest, onProgress?: (done: number, total: number) => void): Promise<{ main: Blob; cover?: Blob }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<PdfResponse>) => {
      const m = e.data;
      if (m.type === 'progress') return onProgress?.(m.done, m.total);
      worker.terminate();
      if (m.type === 'error') return reject(new Error(m.error));
      const pdf = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'application/pdf' });
      resolve({ main: pdf(m.main), cover: m.cover ? pdf(m.cover) : undefined });
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'Error al generar el PDF'));
    };
    worker.postMessage(req);
  });
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const fileSafe = (s: string) => s.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-') || 'librito';
