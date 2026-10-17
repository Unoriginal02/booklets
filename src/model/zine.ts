import type { Booklet, Frame, Rect, ZineTarget } from './types';
import { newFrame } from './geometry';

/**
 * Fanzines de una sola hoja A4. Se imprime en A4 con marcas de corte, se recorta a sangre
 * y se dobla. Cada método dice qué página cae en cada panel de cada cara y si va girada.
 *
 * Los plegados que son solo dobleces sucesivos se calculan doblando la hoja de forma virtual
 * (`simulate`), así la numeración sale de la física del papel y no de una tabla a mano.
 */

export type Rot = 0 | 90 | 180 | 270;

export interface ZinePanel {
  /** 0 = primera página del PDF, 1 = la del reverso */
  side: 0 | 1;
  /** en mm, en coordenadas de esa cara tal como se imprime */
  rect: Rect;
  /** número de página una vez doblado */
  num: number;
  name: string;
  /** giro, en sentido horario, con que la página se imprime en la hoja */
  rot: Rot;
}

export interface GuideLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'fold' | 'cut';
}

export interface ZineMethod {
  id: string;
  name: string;
  summary: string;
  sides: 1 | 2;
  orientation: 'landscape' | 'portrait';
  /** hoja ya recortada */
  trim: { w: number; h: number };
  pages: number;
  panels: ZinePanel[];
  /** dobleces y cortes, en coordenadas de la cara 0 */
  lines: GuideLine[];
  steps: string[];
  /** etiquetas cortas para la tarjeta del método */
  tags: string[];
  /** número del panel que es un póster con la hoja entera, no una página */
  poster?: number;
}

/** «8 páginas», o «8 páginas + póster» */
export function pagesText(m: ZineMethod): string {
  return m.poster ? `${m.pages - 1} páginas + póster` : `${m.pages} páginas`;
}

/** «a», «a y b», «a, b y c» */
const listText = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** El A4 deja sitio alrededor del corte para el sangrado y las marcas. */
export const ZINE_BLEED = 3;
const TRIM_LONG = 270;
const TRIM_SHORT = 180;

export function paperFor(m: Pick<ZineMethod, 'orientation'>) {
  return m.orientation === 'landscape' ? { w: 297, h: 210 } : { w: 210, h: 297 };
}

export function duplexEdge(m: Pick<ZineMethod, 'orientation'>): 'corto' | 'largo' {
  // el reverso se calcula volteando la hoja de izquierda a derecha
  return m.orientation === 'landscape' ? 'corto' : 'largo';
}

/* ------------------------------------------------------------------ */
/* simulador de dobleces                                               */
/* ------------------------------------------------------------------ */

type Mat = [number, number, number, number]; // X = a·x + b·y ; Y = c·x + d·y
const ID: Mat = [1, 0, 0, 1];
const MX: Mat = [-1, 0, 0, 1];
const mul = (p: Mat, q: Mat): Mat => [
  p[0] * q[0] + p[1] * q[2],
  p[0] * q[1] + p[1] * q[3],
  p[2] * q[0] + p[3] * q[2],
  p[2] * q[1] + p[3] * q[3],
];

export interface Fold {
  axis: 'x' | 'y';
  /** la mitad que se queda quieta: 'low' = izquierda / arriba */
  keep: 'low' | 'high';
  /** true: la mitad que se mueve queda encima, hacia ti; false: por detrás */
  over: boolean;
}

export interface SimFace {
  /** índice del panel en la rejilla de la cara A de la simulación */
  panel: number;
  side: 'A' | 'B';
  page: number;
  rot: Rot;
}

export interface SimResult {
  faces: SimFace[];
  /** bordes cerrados por un doblez que no son el lomo, ya nombrados */
  closedEdges: ('cabeza' | 'corte' | 'pie')[];
}

/**
 * Dobla virtualmente una hoja de cols × rows paneles. Devuelve, para cada cara de cada panel,
 * su número de página en el cuadernillo terminado (lomo a la izquierda, portada delante)
 * y cómo va girada en la hoja.
 */
export function simulate(cols: number, rows: number, W: number, H: number, folds: Fold[]): SimResult {
  const pw = W / cols;
  const ph = H / rows;
  const st = Array.from({ length: cols * rows }, (_, i) => ({ c: i % cols, r: Math.floor(i / cols), m: ID as Mat, t: [0, 0], s: 1 }));
  const center = (i: number) => {
    const p = st[i];
    const x = (p.c + 0.5) * pw;
    const y = (p.r + 0.5) * ph;
    return [p.m[0] * x + p.m[1] * y + p.t[0], p.m[2] * x + p.m[3] * y + p.t[1]];
  };
  const key = (v: number[]) => v.map((z) => Math.round(z * 1000)).join(',');
  let stacks = new Map<string, number[]>(st.map((_, i) => [key(center(i)), [i]])); // de abajo arriba
  const reg = [
    [0, W],
    [0, H],
  ];
  const closed = { x: [false, false], y: [false, false] };

  for (const f of folds) {
    const ax = f.axis === 'x' ? 0 : 1;
    const a = (reg[ax][0] + reg[ax][1]) / 2;
    const moving = (v: number[]) => (f.keep === 'low' ? v[ax] > a : v[ax] < a);
    const next = new Map<string, number[]>();
    for (const [k, s] of stacks) if (!moving(center(s[0]))) next.set(k, s.slice());
    for (const s of stacks.values()) {
      if (!moving(center(s[0]))) continue;
      for (const i of s) {
        const p = st[i];
        p.m = ax === 0 ? [-p.m[0], -p.m[1], p.m[2], p.m[3]] : [p.m[0], p.m[1], -p.m[2], -p.m[3]];
        p.t = ax === 0 ? [2 * a - p.t[0], p.t[1]] : [p.t[0], 2 * a - p.t[1]];
        p.s = -p.s;
      }
      // al voltear un montón, el que estaba debajo queda encima
      const flipped = s.slice().reverse();
      const k2 = key(center(s[0]));
      const base = next.get(k2) ?? [];
      next.set(k2, f.over ? [...base, ...flipped] : [...flipped, ...base]);
    }
    stacks = next;
    const e = closed[f.axis];
    if (f.keep === 'low') {
      e[0] ||= e[1];
      e[1] = true;
      reg[ax][1] = a;
    } else {
      e[1] ||= e[0];
      e[0] = true;
      reg[ax][0] = a;
    }
  }
  if (stacks.size !== 1) throw new Error('los dobleces no reducen la hoja a un solo panel');
  const order = [...stacks.values()][0];

  // el último doblez es el lomo; se mira el cuadernillo con el lomo a la izquierda
  const last = folds[folds.length - 1];
  const spine: [number, number] = last.axis === 'x' ? [last.keep === 'low' ? 1 : -1, 0] : [0, last.keep === 'low' ? 1 : -1];
  let N: Mat;
  let fromTop: boolean;
  if (last.axis === 'x') {
    fromTop = spine[0] === -1;
    N = fromTop ? ID : MX;
  } else {
    fromTop = true;
    N = spine[1] === 1 ? [0, -1, 1, 0] : [0, 1, -1, 0];
  }
  const layers = fromTop ? order.slice().reverse() : order;
  const facing = (i: number): 'A' | 'B' => ((st[i].s === 1) === fromTop ? 'A' : 'B');

  const faces: SimFace[] = [];
  layers.forEach((i, idx) => {
    for (const verso of [false, true]) {
      const side = verso === (facing(i) === 'A') ? 'B' : 'A';
      const L = mul(verso ? MX : ID, mul(N, mul(st[i].m, side === 'B' ? MX : ID)));
      // dónde queda, en la hoja, la parte de arriba de la página
      const up = [-L[2], -L[3]].join(',');
      const rot = ({ '0,-1': 0, '1,0': 90, '0,1': 180, '-1,0': 270 } as Record<string, Rot>)[up];
      faces.push({ panel: i, side, page: 2 * idx + (verso ? 2 : 1), rot });
    }
  });

  const names: Record<string, 'cabeza' | 'corte' | 'pie'> = { '0,-1': 'cabeza', '1,0': 'corte', '0,1': 'pie' };
  const closedEdges: SimResult['closedEdges'] = [];
  const edges: [boolean, number, number][] = [
    [closed.x[0], -1, 0],
    [closed.x[1], 1, 0],
    [closed.y[0], 0, -1],
    [closed.y[1], 0, 1],
  ];
  for (const [isClosed, nx, ny] of edges) {
    if (!isClosed || (nx === spine[0] && ny === spine[1])) continue;
    const v = [N[0] * nx + N[1] * ny, N[2] * nx + N[3] * ny].join(',');
    if (names[v]) closedEdges.push(names[v]);
  }
  return { faces, closedEdges };
}

/* ------------------------------------------------------------------ */
/* métodos                                                             */
/* ------------------------------------------------------------------ */

function trimFor(o: ZineMethod['orientation']) {
  return o === 'landscape' ? { w: TRIM_LONG, h: TRIM_SHORT } : { w: TRIM_SHORT, h: TRIM_LONG };
}

function gridLines(cols: number, rows: number, W: number, H: number): GuideLine[] {
  const out: GuideLine[] = [];
  for (let c = 1; c < cols; c++) out.push({ x1: (c * W) / cols, y1: 0, x2: (c * W) / cols, y2: H, kind: 'fold' });
  for (let r = 1; r < rows; r++) out.push({ x1: 0, y1: (r * H) / rows, x2: W, y2: (r * H) / rows, kind: 'fold' });
  return out;
}

const pageName = (n: number, total: number) => (n === 1 ? 'Portada' : n === total ? 'Contraportada' : `Página ${n}`);

function foldText(f: Fold, first: boolean): string {
  const half =
    f.axis === 'x' ? (f.keep === 'low' ? 'la mitad derecha sobre la izquierda' : 'la mitad izquierda sobre la derecha') : f.keep === 'low' ? 'la mitad de abajo sobre la de arriba' : 'la mitad de arriba sobre la de abajo';
  return `${first ? 'Dobla' : 'Sin girar el papel, dobla'} ${half}, ${f.over ? 'por delante (hacia ti)' : 'por detrás'}. Marca bien el pliegue.`;
}

interface SimSpec {
  id: string;
  name: string;
  summary: string;
  orientation: ZineMethod['orientation'];
  cols: number;
  rows: number;
  folds: Fold[];
  /** una cara: solo se imprimen las caras A y quedan dentro las de detrás (doblez francés) */
  singleSided?: boolean;
  binding: string;
  tags: string[];
}

function fromSimulation(spec: SimSpec): ZineMethod {
  const trim = trimFor(spec.orientation);
  const { w: W, h: H } = trim;
  const pw = W / spec.cols;
  const ph = H / spec.rows;
  const sim = simulate(spec.cols, spec.rows, W, H, spec.folds);
  let faces = sim.faces;
  if (spec.singleSided) {
    faces = faces.filter((f) => f.side === 'A').map((f, i) => ({ ...f, page: i + 1 }));
  }
  const total = faces.length;
  // la cara que lleva la portada va primero en el PDF
  const coverSide = faces.find((f) => f.page === 1)!.side;
  const sideIndex = (s: 'A' | 'B'): 0 | 1 => (spec.singleSided || s === coverSide ? 0 : 1);
  const panels: ZinePanel[] = faces.map((f) => {
    const c = f.panel % spec.cols;
    const r = Math.floor(f.panel / spec.cols);
    const col = f.side === 'A' ? c : spec.cols - 1 - c; // el reverso se ve volteado de izquierda a derecha
    return { side: sideIndex(f.side), rect: { x: col * pw, y: r * ph, w: pw, h: ph }, num: f.page, name: pageName(f.page, total), rot: f.rot };
  });
  // las líneas se dan en la cara 0; si la cara 0 es la B de la simulación, se reflejan
  const lines = gridLines(spec.cols, spec.rows, W, H);
  const startSide = sideIndex('A');
  const steps = [
    spec.singleSided ? 'Imprime a una cara, al 100 %, y recorta la hoja por las marcas de corte.' : `Imprime a doble cara, volteando por el borde ${duplexEdge(spec)}, al 100 %. Recorta la hoja por las marcas de corte.`,
    `Pon la hoja con la cara ${startSide === 0 ? 'A' : 'B'} hacia arriba, tal como la ves en la pantalla.`,
    ...spec.folds.map((f, i) => foldText(f, i === 0)),
  ];
  if (!spec.singleSided && sim.closedEdges.length) {
    const map = { cabeza: 'el de arriba (cabeza)', corte: 'el de la derecha (corte)', pie: 'el de abajo (pie)' };
    steps.push(`Abre con un cúter los bordes que quedan cerrados por un doblez, ${listText(sim.closedEdges.map((e) => map[e]))}, para separar las páginas. Si quieres, recorta 1 mm.`);
  }
  steps.push(spec.binding);
  return {
    id: spec.id,
    name: spec.name,
    summary: spec.summary,
    sides: spec.singleSided ? 1 : 2,
    orientation: spec.orientation,
    trim,
    pages: total,
    panels,
    lines,
    steps,
    tags: spec.tags,
  };
}

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

function minizine(): ZineMethod {
  const trim = trimFor('landscape');
  const w = trim.w / 4;
  const h = trim.h / 2;
  // fila de abajo derecha, fila de arriba cabeza abajo: al doblar la de arriba hacia atrás quedan del derecho
  const bottom = [6, 7, 8, 1];
  const top = [5, 4, 3, 2];
  const panels: ZinePanel[] = [
    ...bottom.map((num, c) => ({ side: 0 as const, rect: rect(c * w, h, w, h), num, name: pageName(num, 8), rot: 0 as Rot })),
    ...top.map((num, c) => ({ side: 0 as const, rect: rect(c * w, 0, w, h), num, name: pageName(num, 8), rot: 180 as Rot })),
  ];
  return {
    id: 'minizine-8',
    name: 'Minizine de 8 páginas',
    summary: 'El fanzine clásico de una hoja con un solo corte. Sin grapas: se dobla y se monta solo.',
    sides: 1,
    orientation: 'landscape',
    trim,
    pages: 8,
    panels,
    lines: [
      ...gridLines(4, 1, trim.w, trim.h),
      { x1: 0, y1: h, x2: w, y2: h, kind: 'fold' },
      { x1: 3 * w, y1: h, x2: trim.w, y2: h, kind: 'fold' },
      { x1: w, y1: h, x2: 3 * w, y2: h, kind: 'cut' },
    ],
    steps: [
      'Imprime a una cara, al 100 %, y recorta la hoja por las marcas de corte.',
      'Dobla la hoja por la mitad a lo largo, llevando la fila de arriba hacia atrás. Marca el pliegue y desdobla.',
      'Dobla por la mitad a lo ancho y luego cada mitad otra vez, para marcar los cuatro paneles. Desdobla.',
      'Dobla por la mitad a lo ancho, como un libro, y corta desde el doblez siguiendo la línea roja: solo entre los dos paneles del centro.',
      'Abre la hoja y dóblala a lo largo con las imágenes hacia fuera. Empuja los dos extremos hacia el centro: el corte se abre en forma de rombo.',
      'Sigue empujando hasta formar una cruz de cuatro alas y ciérrala como un librito con la portada (1) delante.',
    ],
    tags: ['8 páginas', `${w}×${h} mm`, 'una cara', '1 corte', 'sin grapas'],
  };
}

/**
 * El minizine con un póster en el reverso: doblado no se ve, y al desplegarlo del todo
 * y darle la vuelta aparece la hoja entera como una sola imagen.
 */
function minizinePoster(): ZineMethod {
  const base = minizine();
  const { trim } = base;
  return {
    ...base,
    id: 'minizine-poster',
    name: 'Minizine con póster',
    summary: 'El minizine de siempre con un secreto: al desplegarlo del todo, por detrás aparece un póster con la hoja entera.',
    sides: 2,
    pages: 9,
    poster: 9,
    panels: [...base.panels, { side: 1, rect: rect(0, 0, trim.w, trim.h), num: 9, name: 'Póster · por dentro', rot: 0 }],
    steps: [
      'Imprime a doble cara, volteando por el borde corto, al 100 %. Recorta la hoja por las marcas de corte.',
      'Pon la hoja con la cara A (las ocho páginas) hacia arriba.',
      ...base.steps.slice(1),
      'Para ver el póster, despliégalo del todo y dale la vuelta. El corte del centro lo cruza: no pongas ahí nada importante.',
    ],
    tags: ['8 páginas + póster', `${trim.w / 4}×${trim.h / 2} mm`, 'doble cara', '1 corte', 'sin grapas'],
  };
}

/**
 * Tête-bêche: dos fanzines de cuatro páginas en uno. La segunda mitad va girada 180°, así
 * que dándole la vuelta, la contraportada es la portada B y las dos lecturas se encuentran
 * en la doble central, cabeza con pie.
 */
function twoVoices(): ZineMethod {
  const base = minizine();
  const names: Record<number, string> = {
    1: 'Portada A',
    2: 'A · pág. 2',
    3: 'A · pág. 3',
    4: 'A · pág. 4 · centro',
    5: 'B · pág. 4 · centro',
    6: 'B · pág. 3',
    7: 'B · pág. 2',
    8: 'Portada B',
  };
  return {
    ...base,
    id: 'dos-voces-8',
    name: 'Fanzine a dos voces',
    summary: 'Dos portadas, una en cada extremo: se lee desde un lado o desde el otro y las dos historias se encuentran en el centro.',
    panels: base.panels.map((p) => ({ ...p, name: names[p.num], rot: (p.num >= 5 ? (p.rot + 180) % 360 : p.rot) as Rot })),
    steps: [
      ...base.steps.slice(0, -1),
      'Sigue empujando hasta formar una cruz de cuatro alas y ciérrala con la portada A (1) delante. Dale la vuelta y gíralo media vuelta: lo que era la contraportada es la portada B (8).',
    ],
    tags: ['2 × 4 páginas', ...base.tags.slice(1)],
  };
}

export const ZINE_METHODS: ZineMethod[] = [
  minizine(),
  minizinePoster(),
  twoVoices(),
  fromSimulation({
    id: 'cuadernillo-8',
    name: 'Cuadernillo de 8 páginas',
    summary: 'La hoja doblada dos veces en cruz. Se abre la cabeza y se grapa por el lomo.',
    orientation: 'portrait',
    cols: 2,
    rows: 2,
    folds: [
      { axis: 'y', keep: 'high', over: true },
      { axis: 'x', keep: 'low', over: true },
    ],
    binding: 'Grapa o cose por el lomo, que es el último doblez.',
    tags: ['8 páginas', '90×135 mm', 'doble cara', 'abrir cabeza', 'grapa'],
  }),
  fromSimulation({
    id: 'cuadernillo-apaisado-8',
    name: 'Cuadernillo apaisado de 8 páginas',
    summary: 'Como el de 8, pero con las páginas en horizontal: para fotos apaisadas a buen tamaño.',
    orientation: 'landscape',
    cols: 2,
    rows: 2,
    folds: [
      { axis: 'y', keep: 'high', over: true },
      { axis: 'x', keep: 'low', over: true },
    ],
    binding: 'Grapa o cose por el lomo, que es el último doblez.',
    tags: ['8 páginas', '135×90 mm', 'doble cara', 'abrir cabeza', 'grapa'],
  }),
  fromSimulation({
    id: 'cuadernillo-16',
    name: 'Cuadernillo de 16 páginas',
    summary: 'La hoja doblada tres veces, como un pliego de imprenta. Se abren los bordes y se grapa por el lomo.',
    orientation: 'landscape',
    cols: 4,
    rows: 2,
    folds: [
      { axis: 'x', keep: 'low', over: true },
      { axis: 'y', keep: 'high', over: true },
      { axis: 'x', keep: 'low', over: true },
    ],
    binding: 'Grapa o cose por el lomo, que es el último doblez.',
    tags: ['16 páginas', '67,5×90 mm', 'doble cara', 'abrir bordes', 'grapa'],
  }),
  fromSimulation({
    id: 'micro-32',
    name: 'Microlibro de 32 páginas',
    summary: 'Cuatro dobleces y un librito diminuto de 32 páginas que cabe en la palma de la mano. Mejor en papel fino.',
    orientation: 'portrait',
    cols: 4,
    rows: 4,
    folds: [
      { axis: 'y', keep: 'high', over: true },
      { axis: 'x', keep: 'low', over: true },
      { axis: 'y', keep: 'high', over: true },
      { axis: 'x', keep: 'low', over: true },
    ],
    binding: 'Grapa o cose por el lomo, que es el último doblez. Con tantas capas, ayúdate de una regla para marcar cada pliegue.',
    tags: ['32 páginas', '45×67,5 mm', 'doble cara', 'abrir bordes', 'grapa'],
  }),
  fromSimulation({
    id: 'frances-4',
    name: 'Doblez francés',
    summary: 'Se imprime a una cara y se dobla dos veces en cruz: las caras en blanco quedan dentro. Ideal para tarjetas.',
    orientation: 'portrait',
    cols: 2,
    rows: 2,
    folds: [
      { axis: 'y', keep: 'high', over: false },
      { axis: 'x', keep: 'low', over: false },
    ],
    singleSided: true,
    binding: 'No hace falta grapar ni cortar.',
    tags: ['4 páginas', '90×135 mm', 'una cara', 'sin grapas'],
  }),
];

const BY_ID = new Map(ZINE_METHODS.map((m) => [m.id, m]));
export const DEFAULT_ZINE = ZINE_METHODS[0];

export function getZineMethod(id: string | undefined): ZineMethod {
  return (id && BY_ID.get(id)) || DEFAULT_ZINE;
}

/* ------------------------------------------------------------------ */
/* recuadros de foto                                                   */
/* ------------------------------------------------------------------ */

export interface ZineFrame {
  target: ZineTarget;
  panel: ZinePanel;
  /** recuadro de la foto en la hoja (con margen o con sangrado en los bordes de corte) */
  rect: Rect;
  /** tamaño del recuadro con la página del derecho */
  size: { w: number; h: number };
  frame: Frame;
}

export const pageSizeOf = (p: ZinePanel) => (p.rot % 180 ? { w: p.rect.h, h: p.rect.w } : { w: p.rect.w, h: p.rect.h });

export function zineFrameRect(m: ZineMethod, p: ZinePanel, margin: number): Rect {
  if (margin > 0) return { x: p.rect.x + margin, y: p.rect.y + margin, w: Math.max(1, p.rect.w - 2 * margin), h: Math.max(1, p.rect.h - 2 * margin) };
  const eps = 0.01;
  const l = p.rect.x < eps ? ZINE_BLEED : 0;
  const t = p.rect.y < eps ? ZINE_BLEED : 0;
  const r = p.rect.x + p.rect.w > m.trim.w - eps ? ZINE_BLEED : 0;
  const b = p.rect.y + p.rect.h > m.trim.h - eps ? ZINE_BLEED : 0;
  return { x: p.rect.x - l, y: p.rect.y - t, w: p.rect.w + l + r, h: p.rect.h + t + b };
}

export function zineFrames(b: Booklet, side?: 0 | 1): ZineFrame[] {
  const m = getZineMethod(b.zine?.methodId);
  const margin = b.zine?.margin ?? 0;
  return m.panels
    .filter((p) => side === undefined || p.side === side)
    .map((p) => {
      const rect = zineFrameRect(m, p, margin);
      return {
        target: { zine: p.num },
        panel: p,
        rect,
        size: p.rot % 180 ? { w: rect.h, h: rect.w } : { w: rect.w, h: rect.h },
        frame: b.zine?.frames[p.num] ?? newFrame(0),
      };
    });
}

/** El recuadro dentro de la página del derecho, para la vista doblada. */
export function frameInPage(p: ZinePanel, rect: Rect): Rect {
  // márgenes en la hoja: arriba, derecha, abajo, izquierda
  const s = [rect.y - p.rect.y, p.rect.x + p.rect.w - (rect.x + rect.w), p.rect.y + p.rect.h - (rect.y + rect.h), rect.x - p.rect.x];
  const k = p.rot / 90;
  const [top, right, bottom, left] = [0, 1, 2, 3].map((i) => s[(i + k) % 4]);
  const page = pageSizeOf(p);
  return { x: left, y: top, w: page.w - left - right, h: page.h - top - bottom };
}

/** Las líneas de guía en la cara pedida (el reverso se ve volteado). */
export function linesFor(m: ZineMethod, side: 0 | 1): GuideLine[] {
  if (side === 0) return m.lines;
  return m.lines.map((l) => ({ ...l, x1: m.trim.w - l.x1, x2: m.trim.w - l.x2 }));
}
