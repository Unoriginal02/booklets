import { getLayout } from './layouts';
import { newFrame } from './geometry';
import type { Booklet, Frame, Page, Spacing, Spread } from './types';

export const uid = () => crypto.randomUUID();

export interface Format {
  id: string;
  name: string;
  w: number;
  h: number;
  /** papel que sale al abrir la hoja: el doble de la página */
  paper: string;
  /** papel mayor donde cabe la hoja centrada con marcas de corte */
  marksPaper: { name: string; w: number; h: number };
  spacing: Spacing;
}

export const FORMATS: Format[] = [
  { id: 'a6', name: 'A6', w: 105, h: 148, paper: 'A5', marksPaper: { name: 'A4', w: 297, h: 210 }, spacing: { top: 8, bottom: 8, outer: 8, inner: 10, gap: 3 } },
  { id: 'a5', name: 'A5', w: 148, h: 210, paper: 'A4', marksPaper: { name: 'A3', w: 420, h: 297 }, spacing: { top: 10, bottom: 10, outer: 10, inner: 12, gap: 4 } },
];

export const DEFAULT_FORMAT = FORMATS[0];

export function getFormat(id: string): Format {
  return FORMATS.find((f) => f.id === id) ?? DEFAULT_FORMAT;
}

export function newPage(layoutId: string, old?: Frame[]): Page {
  const n = getLayout(layoutId).cells.length;
  return { layoutId, frames: Array.from({ length: n }, (_, i) => (old?.[i] ? { ...old[i], slot: i } : newFrame(i))) };
}

export function newSpread(left = 'P1-margen', right = 'P1-margen'): Spread {
  return { id: uid(), mode: 'pages', left: newPage(left), right: newPage(right), full: newPage('D1-pano') };
}

export function blankSpread(): Spread {
  return newSpread('P0-vacia', 'P0-vacia');
}

export function newBooklet(title: string, formatId: string): Booklet {
  const fmt = getFormat(formatId);
  const cover = newSpread('P0-vacia', 'P1-full');
  return {
    id: uid(),
    title,
    formatId: fmt.id,
    pageSize: { w: fmt.w, h: fmt.h },
    bleed: 0,
    spacing: { ...fmt.spacing },
    cover,
    // con solo la cubierta hay una doble: interior de portada | interior de contra
    spreads: [newSpread('P0-vacia', 'P0-vacia')],
    coverInsideBlank: false,
  };
}

export function cloneSpread(s: Spread): Spread {
  return { ...structuredClone(s), id: uid() };
}

export function paperName(w: number, h: number): string {
  const sw = Math.round(2 * w);
  const sh = Math.round(h);
  const papers: [string, number, number][] = [['A3', 420, 297], ['A4', 297, 210], ['A5', 210, 148], ['A6', 148, 105]];
  for (const [n, a, b] of papers) {
    if ((Math.abs(sw - a) <= 1 && Math.abs(sh - b) <= 1) || (Math.abs(sw - b) <= 1 && Math.abs(sh - a) <= 1)) return n;
  }
  return `${sw} × ${sh} mm`;
}

export function newZine(title: string, methodId: string): Booklet {
  // reutiliza la estructura del librito; el fanzine solo usa `zine`
  return { ...newBooklet(title, 'a6'), kind: 'zine', zine: { methodId, margin: 0, frames: {} } };
}
