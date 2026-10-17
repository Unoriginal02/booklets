import { getLayout } from './layouts';
import { centerIndex, isForcedBlank } from './imposition';
import type { Booklet, Frame, Layout, PageKey, Rect, Spacing, Spread, SurfaceKey } from './types';

export const MM_PER_INCH = 25.4;
export const LOW_PPI = 200;
export const TARGET_PPI = 300;

/** global → doble → página */
export function resolveSpacing(global: Spacing, spread?: Partial<Spacing>, page?: Partial<Spacing>): Spacing {
  const out = { ...global };
  for (const src of [spread, page]) {
    if (!src) continue;
    for (const k of Object.keys(src) as (keyof Spacing)[]) {
      const v = src[k];
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
  }
  return out;
}

/**
 * Caja de composición en coordenadas de la doble (ancho 2w): la página izquierda
 * ocupa [0, w] y la derecha [w, 2w]. El exterior/interior se reflejan solos.
 */
export function layoutBox(layout: Layout, page: PageKey, pageW: number, pageH: number, sp: Spacing, bleed: number): Rect {
  const x0 = page === 'right' ? pageW : 0;
  if (page === 'full') {
    if (layout.bleed) return { x: -bleed, y: -bleed, w: 2 * pageW + 2 * bleed, h: pageH + 2 * bleed };
    return { x: sp.outer, y: sp.top, w: 2 * pageW - 2 * sp.outer, h: pageH - sp.top - sp.bottom };
  }
  if (layout.bleed) {
    // a sangre: se extiende por arriba, abajo y el borde de corte, pero no cruza el lomo
    const x = page === 'left' ? -bleed : x0;
    return { x, y: -bleed, w: pageW + bleed, h: pageH + 2 * bleed };
  }
  const left = page === 'left' ? sp.outer : sp.inner;
  const right = page === 'left' ? sp.inner : sp.outer;
  return { x: x0 + left, y: sp.top, w: pageW - left - right, h: pageH - sp.top - sp.bottom };
}

/** Reparte una pista: la calle solo se pone entre recuadros que se tocan de verdad. */
function tracks(fracs: number[], size: number, gap: number, ends: Set<number>, starts: Set<number>) {
  const gaps = fracs.slice(0, -1).map((_, i) => (ends.has(i) && starts.has(i + 1) ? gap : 0));
  const avail = Math.max(0, size - gaps.reduce((a, b) => a + b, 0));
  const total = fracs.reduce((a, b) => a + b, 0) || 1;
  const sizes = fracs.map((f) => (f / total) * avail);
  const pos: number[] = [];
  let p = 0;
  for (let i = 0; i < fracs.length; i++) {
    pos.push(p);
    p += sizes[i] + (gaps[i] ?? 0);
  }
  return { pos, sizes };
}

/** El mayor rectángulo de proporción `aspect` que cabe en la caja, centrado. */
export function fitAspect(box: Rect, aspect: number): Rect {
  const w = Math.min(box.w, box.h * aspect);
  const h = w / aspect;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** plantilla + caja + calle → rectángulos en mm, uno por recuadro */
export function layoutToRects(layout: Layout, box: Rect, gap: number): Rect[] {
  if (layout.aspect) return [fitAspect(box, layout.aspect)];
  const { cols, rows } = layout.grid;
  const colEnds = new Set(layout.cells.map((c) => c.col + c.colSpan - 1));
  const colStarts = new Set(layout.cells.map((c) => c.col));
  const rowEnds = new Set(layout.cells.map((c) => c.row + c.rowSpan - 1));
  const rowStarts = new Set(layout.cells.map((c) => c.row));
  const g = layout.bleed ? 0 : gap;
  const tc = tracks(cols, box.w, g, colEnds, colStarts);
  const tr = tracks(rows, box.h, g, rowEnds, rowStarts);
  return layout.cells.map((cell) => {
    const lastC = cell.col + cell.colSpan - 1;
    const lastR = cell.row + cell.rowSpan - 1;
    return {
      x: box.x + tc.pos[cell.col],
      y: box.y + tr.pos[cell.row],
      w: tc.pos[lastC] + tc.sizes[lastC] - tc.pos[cell.col],
      h: tr.pos[lastR] + tr.sizes[lastR] - tr.pos[cell.row],
    };
  });
}

export function getSurface(b: Booklet, key: SurfaceKey): Spread | undefined {
  return key === 'cover' ? b.cover : b.spreads[key];
}

export interface PlacedFrame {
  surface: SurfaceKey;
  page: PageKey;
  slot: number;
  /** en coordenadas de la doble */
  rect: Rect;
  frame: Frame;
}

export interface SurfacePage {
  page: PageKey;
  layout: Layout;
  spacing: Spacing;
  box: Rect;
  frames: PlacedFrame[];
  blank: boolean;
}

/** Páginas visibles de una superficie con sus recuadros ya colocados. */
export function surfacePages(b: Booklet, key: SurfaceKey): SurfacePage[] {
  const s = getSurface(b, key);
  if (!s) return [];
  const keys: PageKey[] = s.mode === 'full' ? ['full'] : ['left', 'right'];
  const { w, h } = b.pageSize;
  return keys.map((pk) => {
    const page = s[pk];
    const layout = getLayout(page.layoutId);
    const spacing = resolveSpacing(b.spacing, s.spacing, page.spacing);
    const box = layoutBox(layout, pk, w, h, spacing, b.bleed);
    const blank = pk !== 'full' && isForcedBlank(b, key, pk);
    const rects = blank ? [] : layoutToRects(layout, box, spacing.gap);
    const frames = rects.map((rect, slot) => ({
      surface: key,
      page: pk,
      slot,
      rect,
      frame: page.frames[slot] ?? newFrame(slot),
    }));
    return { page: pk, layout, spacing, box, frames, blank };
  });
}

export function allSurfaceKeys(b: Booklet): SurfaceKey[] {
  return ['cover', ...b.spreads.map((_, i) => i)];
}

export function allPlacedFrames(b: Booklet): PlacedFrame[] {
  return allSurfaceKeys(b).flatMap((k) => surfacePages(b, k).flatMap((p) => p.frames));
}

/** 'full' solo en la central (con número impar de dobles) o en la cubierta */
export function fullAllowed(b: Booklet, key: SurfaceKey): boolean {
  if (key === 'cover') return true;
  return key === centerIndex(b.spreads.length);
}

export function newFrame(slot: number): Frame {
  return { slot, fit: 'cover', offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false };
}

export interface Placement {
  /** centro de la foto dentro del recuadro, en mm */
  cx: number;
  cy: number;
  /** tamaño de la imagen sin rotar, en mm */
  iw: number;
  ih: number;
  /** caja ya rotada, en mm */
  rw: number;
  rh: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  /** ppp efectivos */
  ppi: number;
}

export function minScale(fit: Frame['fit']) {
  return fit === 'cover' ? 1 : 0.2;
}
export const MAX_SCALE = 6;

/** Dónde cae la foto dentro de su recuadro. El encuadre se limita para no dejar huecos. */
export function placePhoto(rect: { w: number; h: number }, photo: { w: number; h: number }, f: Pick<Frame, 'fit' | 'offsetX' | 'offsetY' | 'scale' | 'rotation'>): Placement {
  const turned = f.rotation === 90 || f.rotation === 270;
  const pw = turned ? photo.h : photo.w;
  const ph = turned ? photo.w : photo.h;
  const base = f.fit === 'cover' ? Math.max(rect.w / pw, rect.h / ph) : Math.min(rect.w / pw, rect.h / ph);
  const scale = Math.min(MAX_SCALE, Math.max(minScale(f.fit), f.scale));
  const s = base * scale; // mm por píxel
  const rw = pw * s;
  const rh = ph * s;
  const limX = rect.w > 0 ? Math.abs(rw - rect.w) / (2 * rect.w) : 0;
  const limY = rect.h > 0 ? Math.abs(rh - rect.h) / (2 * rect.h) : 0;
  const offsetX = Math.max(-limX, Math.min(limX, f.offsetX));
  const offsetY = Math.max(-limY, Math.min(limY, f.offsetY));
  return {
    cx: rect.w / 2 + offsetX * rect.w,
    cy: rect.h / 2 + offsetY * rect.h,
    iw: photo.w * s,
    ih: photo.h * s,
    rw,
    rh,
    offsetX,
    offsetY,
    scale,
    ppi: MM_PER_INCH / s,
  };
}
