/// <reference lib="webworker" />
// Genera el PDF impuesto en el propio navegador: cada recuadro se rasteriza ya recortado.
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { db } from '../db/db';
import { getSurface, MM_PER_INCH, placePhoto, surfacePages, TARGET_PPI, type PlacedFrame } from '../model/geometry';
import { faceRef, impose, sheetsFor } from '../model/imposition';
import type { Booklet, Photo } from '../model/types';

const PT = 72 / MM_PER_INCH;

/** Papel donde se imprime. Sin él, la página del PDF es la hoja exacta, sin marcas. */
export interface Paper {
  w: number;
  h: number;
}

export type PdfRequest =
  | { kind: 'booklet'; booklet: Booklet; photos: Photo[]; coverSeparate: boolean; paper?: Paper }
  | { kind: 'test'; w: number; h: number; paper?: Paper };

export type PdfResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; main: Uint8Array; cover?: Uint8Array }
  | { type: 'error'; error: string };

const post = (m: PdfResponse, transfer: Transferable[] = []) => self.postMessage(m, transfer);

/** Hoja centrada en el papel; convierte mm desde la esquina superior izquierda de la hoja a puntos PDF. */
function sheetFrame(sheetW: number, sheetH: number, paper?: Paper) {
  const PW = paper?.w ?? sheetW;
  const PH = paper?.h ?? sheetH;
  const ox = (PW - sheetW) / 2;
  const oy = (PH - sheetH) / 2;
  return {
    size: [PW * PT, PH * PT] as [number, number],
    x: (mm: number) => (ox + mm) * PT,
    /** y del borde inferior de algo que empieza en `mm` y mide `hgt` */
    y: (mm: number, hgt = 0) => (PH - oy - mm - hgt) * PT,
  };
}

type SheetFrame = ReturnType<typeof sheetFrame>;

/** Marcas de corte en las esquinas y de pliegue en el centro, fuera de la zona de corte. */
function drawMarks(page: PDFPage, f: SheetFrame, sheetW: number, sheetH: number, bleed: number) {
  const off = bleed + 2;
  const len = 6;
  const black = rgb(0, 0, 0);
  const line = (x1: number, y1: number, x2: number, y2: number, dashed = false) =>
    page.drawLine({
      start: { x: f.x(x1), y: f.y(y1) },
      end: { x: f.x(x2), y: f.y(y2) },
      thickness: 0.3,
      color: black,
      dashArray: dashed ? [2, 2] : undefined,
    });
  for (const cx of [0, sheetW]) {
    for (const cy of [0, sheetH]) {
      const sx = cx === 0 ? -1 : 1;
      const sy = cy === 0 ? -1 : 1;
      line(cx + sx * off, cy, cx + sx * (off + len), cy);
      line(cx, cy + sy * off, cx, cy + sy * (off + len));
    }
  }
  const mid = sheetW / 2;
  line(mid, -off, mid, -off - len, true);
  line(mid, sheetH + off, mid, sheetH + off + len, true);
}

async function rasterize(f: PlacedFrame, photo: Photo, blob: Blob): Promise<ArrayBuffer> {
  const pl = placePhoto(f.rect, photo, f.frame);
  // no se sube la resolución por encima de la que tiene la foto: pesa más y no gana nada
  const ppi = Math.max(96, Math.min(TARGET_PPI, pl.ppi));
  const k = ppi / MM_PER_INCH; // px por mm
  const W = Math.max(1, Math.round(f.rect.w * k));
  const H = Math.max(1, Math.round(f.rect.h * k));
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(pl.cx * k, pl.cy * k);
  ctx.rotate((f.frame.rotation * Math.PI) / 180);
  ctx.scale(f.frame.flipX ? -1 : 1, 1);
  ctx.drawImage(bmp, (-pl.iw / 2) * k, (-pl.ih / 2) * k, pl.iw * k, pl.ih * k);
  bmp.close();
  const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  return out.arrayBuffer();
}

async function buildBooklet(req: Extract<PdfRequest, { kind: 'booklet' }>) {
  const b = req.booklet;
  const { w, h } = b.pageSize;
  const S = sheetsFor(b.spreads.length);
  const F = 4 * S;
  const photos = new Map(req.photos.map((p) => [p.id, p]));
  const sheet = sheetFrame(2 * w, h, req.paper);

  // qué recuadros van en cada cara de cada hoja, con su desplazamiento en la hoja
  const jobs = impose(S).map((side) => {
    const items: { frame: PlacedFrame; dx: number }[] = [];
    const done = new Set<string>();
    for (const [face, x0] of [[side.left, 0], [side.right, w]] as const) {
      const ref = faceRef(face, F);
      const s = getSurface(b, ref.surface)!;
      const pages = surfacePages(b, ref.surface);
      if (s.mode === 'full') {
        // solo la central y la cubierta: ocupan la cara entera, en orden
        const id = String(ref.surface);
        if (done.has(id)) continue;
        done.add(id);
        for (const fr of pages[0].frames) items.push({ frame: fr, dx: 0 });
      } else {
        const page = pages.find((p) => p.page === ref.side)!;
        const dx = x0 - (ref.side === 'right' ? w : 0);
        for (const fr of page.frames) items.push({ frame: fr, dx });
      }
    }
    return { side, items: items.filter((it) => it.frame.frame.photoId && photos.has(it.frame.frame.photoId)) };
  });

  const total = jobs.reduce((n, j) => n + j.items.length, 0);
  let doneCount = 0;
  post({ type: 'progress', done: 0, total });

  const main = await PDFDocument.create();
  const cover = req.coverSeparate ? await PDFDocument.create() : null;
  for (const doc of [main, cover]) {
    doc?.setTitle(b.title);
    doc?.setCreator('Libritos');
  }

  for (const job of jobs) {
    const doc = cover && job.side.sheet === 0 ? cover : main;
    const page = doc.addPage(sheet.size);
    for (const { frame, dx } of job.items) {
      const photo = photos.get(frame.frame.photoId!)!;
      const row = await db.photos.get(photo.id);
      if (row) {
        const jpg = await doc.embedJpg(await rasterize(frame, photo, row.blob));
        const r = frame.rect;
        page.drawImage(jpg, { x: sheet.x(r.x + dx), y: sheet.y(r.y, r.h), width: r.w * PT, height: r.h * PT });
      }
      post({ type: 'progress', done: ++doneCount, total });
    }
    if (req.paper) drawMarks(page, sheet, 2 * w, h, b.bleed);
  }

  const mainBytes = await main.save();
  const coverBytes = cover ? await cover.save() : undefined;
  post({ type: 'done', main: mainBytes, cover: coverBytes }, [mainBytes.buffer, ...(coverBytes ? [coverBytes.buffer] : [])] as Transferable[]);
}

/** Dos páginas para comprobar el volteo de la impresora antes de gastar papel. */
async function buildTest(w: number, h: number, paper?: Paper) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const small = await doc.embedFont(StandardFonts.Helvetica);
  const SW = 2 * w;
  const sheet = sheetFrame(SW, h, paper);
  const ink = rgb(0.15, 0.13, 0.12);
  const gray = rgb(0.6, 0.58, 0.55);
  const letters = [
    ['A', 'B'],
    ['B', 'A'],
  ];
  letters.forEach(([l, r], i) => {
    const p = doc.addPage(sheet.size);
    p.drawLine({ start: { x: sheet.x(w), y: sheet.y(0) }, end: { x: sheet.x(w), y: sheet.y(h) }, thickness: 0.5, color: gray, dashArray: [4, 4] });
    if (paper) {
      p.drawRectangle({ x: sheet.x(0), y: sheet.y(0, h), width: SW * PT, height: h * PT, borderColor: gray, borderWidth: 0.5 });
      drawMarks(p, sheet, SW, h, 0);
    }
    for (const [txt, cx] of [[l, w / 2], [r, w * 1.5]] as const) {
      const size = Math.min(w, h) * PT * 0.6;
      const tw = font.widthOfTextAtSize(txt, size);
      p.drawText(txt, { x: sheet.x(cx) - tw / 2, y: sheet.y(h / 2) - size / 3, size, font, color: ink });
      // flecha hacia arriba: debe apuntar igual en las dos caras
      p.drawSvgPath('M 0 0 L 12 16 L 4 16 L 4 40 L -4 40 L -4 16 L -12 16 Z', { x: sheet.x(cx), y: sheet.y(8), color: ink });
    }
    const caption = i === 0 ? 'CARA A' : 'CARA B';
    p.drawText(caption, { x: sheet.x(6), y: sheet.y(h - 6), size: 9, font, color: ink });
    const note =
      i === 0 ? 'Imprime a doble cara, volteando por el borde corto, al 100 %.' : 'Cada letra debe tener detrás la misma letra y las flechas apuntar hacia el mismo lado.';
    p.drawText(note, { x: sheet.x(6) + font.widthOfTextAtSize(caption, 9) + 8, y: sheet.y(h - 6), size: 7, font: small, color: ink });
  });
  const bytes = await doc.save();
  post({ type: 'done', main: bytes }, [bytes.buffer as ArrayBuffer]);
}

self.onmessage = async (e: MessageEvent<PdfRequest>) => {
  try {
    if (e.data.kind === 'test') await buildTest(e.data.w, e.data.h, e.data.paper);
    else await buildBooklet(e.data);
  } catch (err) {
    post({ type: 'error', error: err instanceof Error ? err.message : String(err) });
  }
};
