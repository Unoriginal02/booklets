import { allPlacedFrames } from './geometry';
import { pageLabel } from './imposition';
import type { AnyTarget, Booklet, Frame } from './types';
import { zineFrames } from './zine';

export interface FrameUse {
  target: AnyTarget;
  /** tamaño del recuadro con la página del derecho, en mm */
  size: { w: number; h: number };
  frame: Frame;
  /** dónde está, para los avisos */
  label: string;
}

/** Todos los recuadros del documento, sea librito o fanzine. */
export function frameUses(b: Booklet): FrameUse[] {
  if (b.kind === 'zine') {
    return zineFrames(b).map((z) => ({ target: z.target, size: z.size, frame: z.frame, label: `Página ${z.panel.num}` }));
  }
  const n = b.spreads.length;
  return allPlacedFrames(b).map((pf) => ({
    target: { surface: pf.surface, page: pf.page, slot: pf.slot },
    size: pf.rect,
    frame: pf.frame,
    label: pf.page === 'full' ? (pf.surface === 'cover' ? 'Cubierta' : `Doble ${(pf.surface as number) + 1}`) : pageLabel(n, pf.surface, pf.page),
  }));
}
