import type { Layout, LayoutCell } from './types';

const c = (col: number, row: number, colSpan = 1, rowSpan = 1): LayoutCell => ({ col, row, colSpan, rowSpan });

const grid = (cols: number, rows: number): LayoutCell[] => {
  const out: LayoutCell[] = [];
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) out.push(c(k, r));
  return out;
};

const ones = (n: number) => Array.from({ length: n }, () => 1);

/**
 * Catálogo de composiciones. Cada una es una rejilla en fracciones; la app la
 * recalcula con los márgenes y la calle vigentes.
 */
export const LAYOUTS: Layout[] = [
  { id: 'P1-full', name: 'A sangre', scope: 'page', bleed: true, grid: { cols: [1], rows: [1] }, cells: [c(0, 0)], basic: true },
  { id: 'P1-margen', name: 'Una grande con margen', scope: 'page', bleed: false, grid: { cols: [1], rows: [1] }, cells: [c(0, 0)], basic: true },
  { id: 'P1-centro', name: 'Una centrada pequeña (60 %)', scope: 'page', bleed: false, grid: { cols: [2, 6, 2], rows: [2, 6, 2] }, cells: [c(1, 1)], basic: true },
  { id: 'P1-alta', name: 'Una vertical estrecha centrada', scope: 'page', bleed: false, grid: { cols: [1, 2, 1], rows: [1] }, cells: [c(1, 0)] },
  { id: 'P1-arriba', name: 'Una arriba + espacio para pie', scope: 'page', bleed: false, grid: { cols: [1], rows: [3, 1] }, cells: [c(0, 0)] },
  { id: 'P2-v', name: 'Dos apiladas', scope: 'page', bleed: false, grid: { cols: [1], rows: [1, 1] }, cells: grid(1, 2), basic: true },
  { id: 'P2-h', name: 'Dos lado a lado', scope: 'page', bleed: false, grid: { cols: [1, 1], rows: [1] }, cells: grid(2, 1) },
  { id: 'P2-asim', name: 'Grande + pequeña (2/3 · 1/3)', scope: 'page', bleed: false, grid: { cols: [1], rows: [2, 1] }, cells: grid(1, 2) },
  { id: 'P2-diag', name: 'Dos en diagonal, desplazadas', scope: 'page', bleed: false, grid: { cols: [1, 1, 1], rows: [1, 1] }, cells: [c(0, 0, 2), c(1, 1, 2)] },
  { id: 'P3-1+2', name: 'Una grande arriba, dos abajo', scope: 'page', bleed: false, grid: { cols: [1, 1], rows: [3, 2] }, cells: [c(0, 0, 2), c(0, 1), c(1, 1)], basic: true },
  { id: 'P3-2+1', name: 'Dos arriba, una grande abajo', scope: 'page', bleed: false, grid: { cols: [1, 1], rows: [2, 3] }, cells: [c(0, 0), c(1, 0), c(0, 1, 2)] },
  { id: 'P3-col', name: 'Grande a la izquierda, dos a la derecha', scope: 'page', bleed: false, grid: { cols: [2, 1], rows: [1, 1] }, cells: [c(0, 0, 1, 2), c(1, 0), c(1, 1)] },
  { id: 'P3-tira', name: 'Tres en tira vertical', scope: 'page', bleed: false, grid: { cols: [1], rows: [1, 1, 1] }, cells: grid(1, 3) },
  { id: 'P4-grid', name: 'Rejilla 2×2', scope: 'page', bleed: false, grid: { cols: [1, 1], rows: [1, 1] }, cells: grid(2, 2), basic: true },
  { id: 'P4-1+3', name: 'Una grande + tres en fila', scope: 'page', bleed: false, grid: { cols: [1, 1, 1], rows: [3, 1] }, cells: [c(0, 0, 3), c(0, 1), c(1, 1), c(2, 1)] },
  { id: 'P6-grid', name: 'Rejilla 2×3', scope: 'page', bleed: false, grid: { cols: [1, 1], rows: [1, 1, 1] }, cells: grid(2, 3) },
  { id: 'P9-contacto', name: 'Hoja de contactos 3×3', scope: 'page', bleed: false, grid: { cols: ones(3), rows: ones(3) }, cells: grid(3, 3) },
  { id: 'P0-vacia', name: 'Página en blanco', scope: 'page', bleed: false, grid: { cols: [1], rows: [1] }, cells: [], basic: true },

  { id: 'D1-pano', name: 'Panorámica a sangre', scope: 'spread', bleed: true, grid: { cols: [1], rows: [1] }, cells: [c(0, 0)] },
  { id: 'D1-pano-margen', name: 'Panorámica con margen', scope: 'spread', bleed: false, grid: { cols: [1], rows: [1] }, cells: [c(0, 0)] },
  { id: 'D2-pano+1', name: 'Panorámica + una pequeña encima', scope: 'spread', bleed: false, grid: { cols: ones(4), rows: [1, 2] }, cells: [c(0, 1, 4), c(2, 0)] },
  { id: 'D3-tira', name: 'Tira horizontal de 3 cruzando el lomo', scope: 'spread', bleed: false, grid: { cols: ones(3), rows: [1, 2, 1] }, cells: [c(0, 1), c(1, 1), c(2, 1)] },
];

export type Orientation = 'v' | 'h';
export type RatioGroup = 'foto' | 'cine' | 'ultra';

export interface Ratio {
  /** solo dígitos y una x, para el id de la plantilla */
  id: string;
  /** escrita en horizontal */
  label: string;
  long: number;
  short: number;
  group: RatioGroup;
  note: string;
}

export const RATIO_GROUPS: { id: RatioGroup; name: string }[] = [
  { id: 'foto', name: 'Foto' },
  { id: 'cine', name: 'Cine' },
  { id: 'ultra', name: 'Ultra panorámica' },
];

/** Proporciones habituales, escritas en horizontal (lado largo : lado corto). */
export const RATIOS: Ratio[] = [
  { id: '1x1', label: '1:1', long: 1, short: 1, group: 'foto', note: 'Cuadrada · 6×6, Instagram' },
  { id: '5x4', label: '5:4', long: 5, short: 4, group: 'foto', note: '4×5, 8×10 · gran formato' },
  { id: '4x3', label: '4:3', long: 4, short: 3, group: 'foto', note: 'Móvil, micro 4/3, 6×4,5' },
  { id: '7x5', label: '7:5', long: 7, short: 5, group: 'foto', note: 'Copia 13×18' },
  { id: '3x2', label: '3:2', long: 3, short: 2, group: 'foto', note: '35 mm, réflex · copia 10×15' },
  { id: '16x9', label: '16:9', long: 16, short: 9, group: 'foto', note: 'Panorámica de móvil, vídeo HD' },

  { id: '143x100', label: '1,43:1', long: 1.43, short: 1, group: 'cine', note: 'IMAX 70 mm' },
  { id: '185x100', label: '1,85:1', long: 1.85, short: 1, group: 'cine', note: 'Flat · panorámico estándar de cine' },
  { id: '2x1', label: '2:1', long: 2, short: 1, group: 'cine', note: 'Univisium · series y cine digital' },
  { id: '239x100', label: '2,39:1', long: 2.39, short: 1, group: 'cine', note: 'Scope · anamórfico' },
  { id: '276x100', label: '2,76:1', long: 2.76, short: 1, group: 'cine', note: 'Ultra Panavision 70' },

  { id: '21x9', label: '21:9', long: 21, short: 9, group: 'ultra', note: 'Monitor ultrapanorámico (2,33:1)' },
  { id: '65x24', label: '65:24', long: 65, short: 24, group: 'ultra', note: 'Hasselblad XPan (2,7:1)' },
  { id: '3x1', label: '3:1', long: 3, short: 1, group: 'ultra', note: '6×17 · Fuji GX617, Linhof' },
  { id: '32x9', label: '32:9', long: 32, short: 9, group: 'ultra', note: 'Super ultrapanorámico (3,56:1)' },
  { id: '4x1', label: '4:1', long: 4, short: 1, group: 'ultra', note: 'Tira panorámica · 360° recortado' },
];

/** La etiqueta de la proporción en la orientación dada: 3:2 ↔ 2:3, 2,39:1 ↔ 1:2,39 */
export function ratioLabel(r: Ratio, o: Orientation | null): string {
  if (o !== 'v' || r.long === r.short) return r.label;
  const [a, b] = r.label.split(':');
  return b + ':' + a;
}

/** En la doble central, proporciones horizontales a partir de 3:2: cruzan el pliegue */
export const SPREAD_RATIOS = RATIOS.filter((r) => r.long / r.short >= 1.5);

export function ratioLayoutId(ratioId: string, o: Orientation, scope: 'page' | 'spread' = 'page'): string {
  if (scope === 'spread') return 'RD-' + ratioId;
  return ratioId === '1x1' ? 'R-1x1' : 'R-' + ratioId + '-' + o;
}

/** 'R-3x2-v' → { ratioId: '3x2', o: 'v' } · 'RD-21x9' → { ratioId: '21x9', o: 'h' } */
export function parseRatioLayout(id: string): { ratioId: string; o: Orientation | null } | null {
  const d = /^RD-(\d+x\d+)$/.exec(id);
  if (d) return { ratioId: d[1], o: 'h' };
  const m = /^R-(\d+x\d+)(?:-([vh]))?$/.exec(id);
  return m ? { ratioId: m[1], o: (m[2] as Orientation) ?? null } : null;
}

const one = (id: string, name: string, scope: 'page' | 'spread', aspect: number): Layout => ({
  id,
  name,
  scope,
  bleed: false,
  grid: { cols: [1], rows: [1] },
  cells: [c(0, 0)],
  aspect,
});

for (const r of RATIOS) {
  const square = r.long === r.short;
  for (const o of square ? (['h'] as const) : (['v', 'h'] as const)) {
    const a = o === 'h' ? r.long / r.short : r.short / r.long;
    const name = square ? r.label + ' centrada' : ratioLabel(r, o) + (o === 'h' ? ' horizontal' : ' vertical') + ' centrada';
    LAYOUTS.push(one(ratioLayoutId(r.id, o), name, 'page', a));
  }
}
for (const r of SPREAD_RATIOS) {
  LAYOUTS.push(one(ratioLayoutId(r.id, 'h', 'spread'), r.label + ' centrada en la doble', 'spread', r.long / r.short));
}

const BY_ID = new Map(LAYOUTS.map((l) => [l.id, l]));

export function getLayout(id: string): Layout {
  return BY_ID.get(id) ?? BY_ID.get('P0-vacia')!;
}

export const PAGE_LAYOUTS = LAYOUTS.filter((l) => l.scope === 'page' && !l.aspect);
export const RATIO_LAYOUTS = LAYOUTS.filter((l) => l.scope === 'page' && l.aspect);
export const SPREAD_LAYOUTS = LAYOUTS.filter((l) => l.scope === 'spread' && !l.aspect);

/** En la cubierta la doble completa se presenta como "envolvente". */
export const COVER_FULL_NAMES: Record<string, string> = {
  'D1-pano': 'Envolvente: contra y portada a sangre',
  'D1-pano-margen': 'Envolvente con margen',
};
