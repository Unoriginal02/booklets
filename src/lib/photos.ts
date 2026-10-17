import { db, type PhotoRow } from '../db/db';
import { uid } from '../model/factory';
import type { Photo } from '../model/types';

type Decoded = { ok: true; w: number; h: number; preview: Blob; thumb: Blob } | { ok: false; error: string };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: Decoded) => void>();

function decode(blob: Blob): Promise<Decoded> {
  if (!worker) {
    worker = new Worker(new URL('./photo.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, ...rest } = e.data;
      pending.get(id)?.(rest as Decoded);
      pending.delete(id);
    };
  }
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker!.postMessage({ id, blob });
  });
}

const isHeic = (f: File) => /\.(heic|heif)$/i.test(f.name) || /hei[cf]/i.test(f.type);

/** Importa archivos a la bandeja del librito. Devuelve las fotos creadas y los nombres que fallaron. */
export async function importPhotos(bookletId: string, files: File[]): Promise<{ photos: Photo[]; failed: string[] }> {
  const photos: Photo[] = [];
  const failed: string[] = [];
  for (const file of files) {
    let blob: Blob = file;
    let res = await decode(blob);
    if (!res.ok && isHeic(file)) {
      // Safari abre HEIC de forma nativa; el resto necesita convertirlo
      try {
        const { default: heic2any } = await import('heic2any');
        const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
        blob = Array.isArray(out) ? out[0] : out;
        res = await decode(blob);
      } catch {
        /* se marca como fallida abajo */
      }
    }
    if (!res.ok) {
      failed.push(file.name);
      continue;
    }
    const row: PhotoRow = {
      id: uid(),
      bookletId,
      name: file.name,
      w: res.w,
      h: res.h,
      createdAt: Date.now(),
      blob,
      preview: res.preview,
      thumb: res.thumb,
    };
    await db.photos.put(row);
    cacheUrls(row);
    photos.push(stripBlobs(row));
  }
  return { photos, failed };
}

/** Guarda una foto ya decodificable (p. ej. de un archivo .librito) con un id nuevo. */
export async function addPhotoBlob(bookletId: string, blob: Blob, name: string, createdAt = Date.now()): Promise<Photo | null> {
  const res = await decode(blob);
  if (!res.ok) return null;
  const row: PhotoRow = { id: uid(), bookletId, name, w: res.w, h: res.h, createdAt, blob, preview: res.preview, thumb: res.thumb };
  await db.photos.put(row);
  cacheUrls(row);
  return stripBlobs(row);
}

export function stripBlobs({ blob: _b, preview: _p, thumb: _t, ...meta }: PhotoRow): Photo {
  return meta;
}

const urls = new Map<string, { preview: string; thumb: string }>();

function cacheUrls(row: PhotoRow) {
  if (urls.has(row.id)) return;
  urls.set(row.id, { preview: URL.createObjectURL(row.preview), thumb: URL.createObjectURL(row.thumb) });
}

export function photoUrl(id: string | undefined, kind: 'preview' | 'thumb' = 'preview'): string | undefined {
  return id ? urls.get(id)?.[kind] : undefined;
}

export async function loadPhotos(bookletId: string): Promise<Photo[]> {
  const rows = await db.photos.where('bookletId').equals(bookletId).sortBy('createdAt');
  rows.forEach(cacheUrls);
  return rows.map(stripBlobs);
}

export async function removePhoto(id: string) {
  await db.photos.delete(id);
  const u = urls.get(id);
  if (u) {
    URL.revokeObjectURL(u.preview);
    URL.revokeObjectURL(u.thumb);
    urls.delete(id);
  }
}
