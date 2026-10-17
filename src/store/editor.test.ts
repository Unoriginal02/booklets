import { beforeEach, describe, expect, it } from 'vitest';
import { newBooklet, newSpread } from '../model/factory';
import { useEditor } from './editor';

const st = () => useEditor.getState();
const b = () => st().booklet!;

describe('copiar y pegar el diseño de una página', () => {
  beforeEach(() => {
    const bk = newBooklet('x', 'a6');
    bk.spreads.push(newSpread(), newSpread());
    st().load(bk, []);
  });

  it('pega composición, tamaño, posición y márgenes, y deja las fotos', () => {
    st().setLayout(1, 'left', 'R-16x9-h');
    st().setLook(1, 'left', { bleed: false, scale: 0.6, align: 'start' });
    st().edit((d) => void (d.spreads[1].left.spacing = { top: 20 }));
    st().updateFrame({ surface: 2, page: 'right', slot: 0 }, { photoId: 'foto' });

    st().copyStyle(1, 'left');
    st().pasteStyle(2, 'right');

    const p = b().spreads[2].right;
    expect(p).toMatchObject({ layoutId: 'R-16x9-h', scale: 0.6, align: 'start', spacing: { top: 20 } });
    expect(p.frames[0].photoId).toBe('foto');
    // la copia no comparte objetos con el original
    st().edit((d) => void (d.spreads[1].left.spacing!.top = 5));
    expect(b().spreads[2].right.spacing!.top).toBe(20);
  });

  it('un diseño de página no se pega en una doble entera', () => {
    st().copyStyle(1, 'left');
    const before = b().spreads[1].full;
    st().pasteStyle(1, 'full');
    expect(b().spreads[1].full).toBe(before);
  });

  it('pegar en todas respeta las páginas en blanco de la cartulina y las dobles completas', () => {
    st().edit((d) => {
      d.coverInsideBlank = true;
      d.spreads[1].mode = 'full';
    });
    st().setLayout(1, 'right', 'P4-grid');
    st().copyStyle(1, 'right');
    const blankBefore = [b().spreads[0].left, b().spreads[2].right];
    st().pasteStyleEverywhere();
    const s = b().spreads;
    // interior de portada y de contra, en blanco por la cartulina: no se tocan
    expect([s[0].left, s[2].right]).toEqual(blankBefore);
    expect(s[0].right.layoutId).toBe('P4-grid');
    expect(s[1].full.layoutId).toBe('D1');
    expect(s[2].left.layoutId).toBe('P4-grid');
    expect(b().cover.right.layoutId).toBe('P1');
  });
});
