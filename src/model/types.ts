export type Mm = number;

/** Márgenes y calle, en mm. */
export interface Spacing {
  top: Mm;
  bottom: Mm;
  outer: Mm;
  inner: Mm;
  /** separación entre recuadros */
  gap: Mm;
}

export type PageSide = 'left' | 'right';
export type PageKey = PageSide | 'full';

/** 'cover' = exterior de la cubierta (contra | portada); número = índice de la doble en orden de lectura. */
export type SurfaceKey = 'cover' | number;

export interface Frame {
  /** posición en la plantilla */
  slot: number;
  photoId?: string;
  fit: 'cover' | 'contain';
  /** encuadre, en fracción del recuadro (0 = centrado) */
  offsetX: number;
  offsetY: number;
  /** 1 = rellena justo */
  scale: number;
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
}

export interface Page {
  layoutId: string;
  frames: Frame[];
  spacing?: Partial<Spacing>;
}

/**
 * Una doble página tal como se ve el librito abierto. Se guardan siempre las tres
 * variantes para no perder contenido al cambiar de modo.
 */
export interface Spread {
  id: string;
  /** 'full' solo es válido en la doble central y en el exterior de la cubierta */
  mode: 'pages' | 'full';
  left: Page;
  right: Page;
  full: Page;
  spacing?: Partial<Spacing>;
}

export interface Booklet {
  id: string;
  title: string;
  formatId: string;
  /** tamaño de UNA página */
  pageSize: { w: Mm; h: Mm };
  /** 0 o 3 */
  bleed: Mm;
  /** valor global */
  spacing: Spacing;
  /** exterior de la cubierta: left = contraportada, right = portada */
  cover: Spread;
  /**
   * Dobles en orden de lectura. La primera lleva el interior de portada a la izquierda
   * y la última el interior de contra a la derecha.
   */
  spreads: Spread[];
  coverInsideBlank: boolean;
}

export interface Photo {
  id: string;
  bookletId: string;
  name: string;
  /** píxeles, ya con la orientación EXIF aplicada */
  w: number;
  h: number;
  createdAt: number;
}

export interface LayoutCell {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface Layout {
  id: string;
  name: string;
  scope: 'page' | 'spread';
  /** ignora márgenes y se extiende al sangrado */
  bleed: boolean;
  /** fracciones, p. ej. [2, 1] */
  grid: { cols: number[]; rows: number[] };
  cells: LayoutCell[];
  basic?: boolean;
  /** ancho/alto fijo: un solo recuadro, lo mayor posible dentro de los márgenes y centrado */
  aspect?: number;
}

export interface Rect {
  x: Mm;
  y: Mm;
  w: Mm;
  h: Mm;
}

export interface FrameTarget {
  surface: SurfaceKey;
  page: PageKey;
  slot: number;
}
