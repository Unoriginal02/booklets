import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { db, saveBooklet } from '../db/db';
import { uid } from '../model/factory';
import type { Booklet, Photo } from '../model/types';
import { addPhotoBlob } from './photos';

/**
 * Un librito o fanzine en un solo archivo .librito: un ZIP con la maqueta en JSON y
 * las fotos originales, para llevarlo a otro navegador o dispositivo.
 */

const MANIFEST = 'librito.json';
export const ARCHIVE_EXT = '.librito';

interface Manifest {
  app: 'libritos';
  version: 1;
  exportedAt: string;
  booklet: Booklet;
  photos: (Photo & { type: string })[];
}

export async function exportArchive(b: Booklet): Promise<Blob> {
  const rows = await db.photos.where('bookletId').equals(b.id).sortBy('createdAt');
  const manifest: Manifest = {
    app: 'libritos',
    version: 1,
    exportedAt: new Date().toISOString(),
    booklet: b,
    photos: rows.map(({ blob, preview: _p, thumb: _t, ...meta }) => ({ ...meta, type: blob.type || 'image/jpeg' })),
  };
  const files: Zippable = { [MANIFEST]: strToU8(JSON.stringify(manifest, null, 1)) };
  // las fotos ya van comprimidas: se guardan tal cual, que es mucho más rápido
  for (const r of rows) files[`fotos/${r.id}`] = [new Uint8Array(await r.blob.arrayBuffer()), { level: 0 }];
  return new Blob([zipSync(files) as BlobPart], { type: 'application/zip' });
}

/** Cambia cada `photoId` según el mapa; los que no están se quitan. */
function remapPhotos<T>(value: T, map: Map<string, string>): T {
  if (Array.isArray(value)) return value.map((v) => remapPhotos(v, map)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'photoId') {
        const id = typeof v === 'string' ? map.get(v) : undefined;
        if (id) out[k] = id;
      } else out[k] = remapPhotos(v, map);
    }
    return out as T;
  }
  return value;
}

export class ArchiveError extends Error {}

/** Importa un .librito como una copia nueva. Devuelve el id del librito creado. */
export async function importArchive(file: File, onProgress?: (done: number, total: number) => void): Promise<string> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new ArchiveError('El archivo no es un .librito válido o está dañado.');
  }
  const raw = files[MANIFEST];
  if (!raw) throw new ArchiveError('Al archivo le falta la maqueta (librito.json).');
  const manifest = JSON.parse(strFromU8(raw)) as Manifest;
  if (manifest.app !== 'libritos' || !manifest.booklet) throw new ArchiveError('Este archivo no es de Libritos.');

  const id = uid();
  const map = new Map<string, string>();
  const total = manifest.photos.length;
  let done = 0;
  for (const p of manifest.photos) {
    const data = files[`fotos/${p.id}`];
    if (data) {
      const photo = await addPhotoBlob(id, new Blob([data as BlobPart], { type: p.type }), p.name, p.createdAt);
      if (photo) map.set(p.id, photo.id);
    }
    onProgress?.(++done, total);
  }
  const booklet: Booklet = { ...remapPhotos(manifest.booklet, map), id };
  await saveBooklet(booklet);
  return id;
}
