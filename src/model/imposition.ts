import type { Booklet, PageSide, Spread, SurfaceKey } from './types';

/**
 * Índice (base 0) de la doble central. Con un número impar n de dobles es la del medio.
 * Con n par falta media hoja: al exportar se inserta una doble en blanco antes de la
 * última, así que la central provisional es n/2 (salvo con 2 dobles, donde sería la de relleno).
 */
export function centerIndex(n: number): number {
  if (n % 2 === 1) return (n - 1) / 2;
  return n >= 4 ? n / 2 : -1;
}

export function sheetsFor(n: number): number {
  return Math.ceil((n + 1) / 2);
}

/** Inserta la doble en blanco que cierra la hoja, antes de la última. */
export function padSpreads<T>(spreads: T[], blank: () => T): T[] {
  if (spreads.length % 2 === 1) return spreads;
  const out = spreads.slice();
  out.splice(Math.max(0, out.length - 1), 0, blank());
  return out;
}

export type FaceRef = { surface: SurfaceKey; side: PageSide };

/**
 * Cara física f (1 = portada … F = contraportada) → dónde está su contenido.
 * Las caras interiores 2k y 2k+1 forman la doble k (base 1).
 */
export function faceRef(f: number, F: number): FaceRef {
  if (f === 1) return { surface: 'cover', side: 'right' };
  if (f === F) return { surface: 'cover', side: 'left' };
  return { surface: Math.floor(f / 2) - 1, side: f % 2 === 0 ? 'left' : 'right' };
}

export interface SheetSide {
  /** 0 = cubierta */
  sheet: number;
  side: 'A' | 'B';
  left: number;
  right: number;
}

/**
 * Orden de impresión para S hojas, de la exterior a la interior.
 * Cara A: [F−2i | 1+2i] · Cara B: [2+2i | F−1−2i]
 */
export function impose(S: number): SheetSide[] {
  const F = 4 * S;
  const out: SheetSide[] = [];
  for (let i = 0; i < S; i++) {
    out.push({ sheet: i, side: 'A', left: F - 2 * i, right: 1 + 2 * i });
    out.push({ sheet: i, side: 'B', left: 2 + 2 * i, right: F - 1 - 2 * i });
  }
  return out;
}

/** El interior de cubierta se deja en blanco cuando va en cartulina. */
export function isForcedBlank(b: Pick<Booklet, 'coverInsideBlank' | 'spreads'>, key: SurfaceKey, side: PageSide): boolean {
  if (!b.coverInsideBlank || key === 'cover') return false;
  return (key === 0 && side === 'left') || (key === b.spreads.length - 1 && side === 'right');
}

export function pageLabel(n: number, key: SurfaceKey, side: PageSide | 'full'): string {
  if (key === 'cover') return side === 'left' ? 'Contraportada' : side === 'right' ? 'Portada' : 'Cubierta';
  if (side === 'full') return 'Doble página';
  if (key === 0 && side === 'left') return 'Interior de portada';
  if (key === n - 1 && side === 'right') return 'Interior de contra';
  // doble k (base 0): caras 2(k+1) y 2(k+1)+1; la pág. 1 es la cara 3
  const face = 2 * (key + 1) + (side === 'right' ? 1 : 0);
  return `Pág. ${face - 2}`;
}

export function isFullValid(spreads: Pick<Spread, 'mode'>[], index: number): boolean {
  return spreads[index].mode !== 'full' || index === centerIndex(spreads.length);
}
