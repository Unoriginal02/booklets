import { describe, expect, it } from 'vitest';
import { centerIndex, faceRef, impose, padSpreads, pageLabel } from './imposition';
import { layoutToRects, marginBox, pageRects, placePhoto, resolveSpacing, verticalSlack } from './geometry';
import { DEFAULT_LOOK, getLayout, pageLook, parseRatioLayout, RATIO_LAYOUTS, RATIOS, ratioLabel, ratioLayoutId, SPREAD_RATIOS, upgradePage } from './layouts';
import { newBooklet, upgradeBooklet } from './factory';

describe('impose', () => {
  it('coincide con la tabla del briefing para 3 hojas', () => {
    const r = impose(3).map((s) => [s.left, s.right]);
    expect(r).toEqual([
      [12, 1],
      [2, 11],
      [10, 3],
      [4, 9],
      [8, 5],
      [6, 7],
    ]);
  });

  for (let S = 1; S <= 12; S++) {
    it(`es una imposición válida con ${S} hojas`, () => {
      const F = 4 * S;
      const sides = impose(S);
      expect(sides).toHaveLength(2 * S);
      const seen = sides.flatMap((s) => [s.left, s.right]).sort((a, b) => a - b);
      expect(seen).toEqual(Array.from({ length: F }, (_, i) => i + 1));

      for (let i = 0; i < S; i++) {
        const A = sides[2 * i];
        const B = sides[2 * i + 1];
        // volteo por el borde corto: lo que está a la derecha de A queda detrás, a la izquierda de B
        // cada hoja es una pareja de hojas (recto impar, verso par) a cada lado del pliegue
        expect(B.left).toBe(A.right + 1);
        expect(A.left).toBe(B.right + 1);
        // hojas anidadas: la i-ésima envuelve a la siguiente
        expect(A.right).toBe(1 + 2 * i);
      }
      // la cara B de la hoja más interna es la doble central y es continua
      const inner = sides[2 * S - 1];
      expect(inner.right).toBe(inner.left + 1);
      const ref = faceRef(inner.left, F);
      expect(ref.surface).toBe(centerIndex(2 * S - 1));
    });
  }

  it('traduce caras a dobles', () => {
    expect(faceRef(1, 12)).toEqual({ surface: 'cover', side: 'right' });
    expect(faceRef(12, 12)).toEqual({ surface: 'cover', side: 'left' });
    expect(faceRef(2, 12)).toEqual({ surface: 0, side: 'left' });
    expect(faceRef(11, 12)).toEqual({ surface: 4, side: 'right' });
    expect(faceRef(6, 12)).toEqual({ surface: 2, side: 'left' });
  });
});

describe('centerIndex y relleno', () => {
  it('central con impares', () => {
    expect(centerIndex(1)).toBe(0);
    expect(centerIndex(3)).toBe(1);
    expect(centerIndex(5)).toBe(2);
  });
  it('rellena antes de la última y conserva la central provisional', () => {
    const padded = padSpreads(['a', 'b', 'c', 'd'], () => '_');
    expect(padded).toEqual(['a', 'b', 'c', '_', 'd']);
    expect(padded[centerIndex(5)]).toBe(['a', 'b', 'c', 'd'][centerIndex(4)]);
    expect(padSpreads(['a', 'b', 'c'], () => '_')).toEqual(['a', 'b', 'c']);
  });
  it('etiquetas', () => {
    expect(pageLabel(5, 0, 'left')).toBe('Interior de portada');
    expect(pageLabel(5, 0, 'right')).toBe('Pág. 1');
    expect(pageLabel(5, 2, 'right')).toBe('Pág. 5');
    expect(pageLabel(5, 4, 'left')).toBe('Pág. 8');
    expect(pageLabel(5, 4, 'right')).toBe('Interior de contra');
  });
});

describe('geometría', () => {
  const g = { top: 10, bottom: 20, outer: 8, inner: 12, gap: 4 };

  it('resolveSpacing: global → doble → página', () => {
    expect(resolveSpacing(g, { top: 5 }, { gap: 2 })).toEqual({ ...g, top: 5, gap: 2 });
    expect(resolveSpacing(g, { top: 5 }, { top: 7 })).toEqual({ ...g, top: 7 });
  });

  it('refleja exterior e interior', () => {
    expect(marginBox('left', 148, 210, g)).toEqual({ x: 8, y: 10, w: 128, h: 180 });
    expect(marginBox('right', 148, 210, g)).toEqual({ x: 160, y: 10, w: 128, h: 180 });
  });

  it('reparte la calle solo entre recuadros vecinos', () => {
    const box = { x: 0, y: 0, w: 100, h: 104 };
    const [a, b] = layoutToRects(getLayout('P2-v'), box, 4);
    expect(a).toEqual({ x: 0, y: 0, w: 100, h: 50 });
    expect(b).toEqual({ x: 0, y: 54, w: 100, h: 50 });
  });

  it('el recuadro grande abarca la calle interna', () => {
    const [big, s1, s2] = layoutToRects(getLayout('P3-col'), { x: 0, y: 0, w: 94, h: 104 }, 4);
    expect(big.h).toBe(104);
    expect(s1.h + s2.h + 4).toBeCloseTo(104);
    expect(big.w + 4 + s1.w).toBeCloseTo(94);
  });

  it('placePhoto rellena y limita el encuadre', () => {
    const p = placePhoto({ w: 100, h: 100 }, { w: 2000, h: 1000 }, { fit: 'cover', offsetX: 5, offsetY: 0, scale: 1, rotation: 0 });
    expect(p.rw).toBeCloseTo(200);
    expect(p.rh).toBeCloseTo(100);
    expect(p.offsetX).toBeCloseTo(0.5);
    expect(p.ppi).toBeCloseTo(254);
    const r = placePhoto({ w: 100, h: 100 }, { w: 2000, h: 1000 }, { fit: 'cover', offsetX: 0, offsetY: 0, scale: 1, rotation: 90 });
    expect(r.rw).toBeCloseTo(100);
    expect(r.rh).toBeCloseTo(200);
  });

  it('las proporciones quedan centradas y caben en los márgenes', () => {
    const box = { x: 8, y: 8, w: 89, h: 132 }; // A6 con 8 mm de margen
    expect(RATIO_LAYOUTS).toHaveLength(2 * RATIOS.length - 1);
    for (const l of RATIO_LAYOUTS) {
      const [r] = layoutToRects(l, box, 3);
      expect(r.w / r.h).toBeCloseTo(l.aspect!);
      expect(r.w).toBeLessThanOrEqual(box.w + 1e-9);
      expect(r.h).toBeLessThanOrEqual(box.h + 1e-9);
      expect(r.x - box.x).toBeCloseTo(box.x + box.w - (r.x + r.w));
      expect(r.y - box.y).toBeCloseTo(box.y + box.h - (r.y + r.h));
    }
    const [v] = layoutToRects(getLayout('R-3x2-v'), box, 3);
    expect(v.w).toBeCloseTo(88); // 2:3 vertical: limita la altura, 132 × 2/3
    expect(parseRatioLayout(ratioLayoutId('3x2', 'h'))).toEqual({ ratioId: '3x2', o: 'h' });
    expect(parseRatioLayout('R-1x1')).toEqual({ ratioId: '1x1', o: null });
    expect(parseRatioLayout('P1')).toBeNull();
    expect(parseRatioLayout('RD-239x100')).toEqual({ ratioId: '239x100', o: 'h' });
    expect(ratioLabel(RATIOS.find((r) => r.id === '239x100')!, 'v')).toBe('1:2,39');
  });

  it('las panorámicas de la doble quedan centradas sobre el lomo', () => {
    // doble A6: 210 × 148, con 8 mm de margen exterior, superior e inferior
    const sp = { top: 8, bottom: 8, outer: 8, inner: 10, gap: 3 };
    const box = marginBox('full', 105, 148, sp);
    expect(box).toEqual({ x: 8, y: 8, w: 194, h: 132 });
    for (const r of SPREAD_RATIOS) {
      const [rect] = layoutToRects(getLayout(ratioLayoutId(r.id, 'h', 'spread')), box, 3);
      expect(rect.w / rect.h).toBeCloseTo(r.long / r.short);
      expect(rect.x + rect.w / 2).toBeCloseTo(105);
    }
    const [scope] = layoutToRects(getLayout('RD-239x100'), box, 3);
    expect(scope.w).toBeCloseTo(194);
    expect(scope.h).toBeCloseTo(194 / 2.39);
  });

  describe('tamaño y posición', () => {
    const sp = { top: 8, bottom: 8, outer: 8, inner: 10, gap: 3 };
    const look = (l: Partial<typeof DEFAULT_LOOK>) => ({ ...DEFAULT_LOOK, ...l });

    it('la página a sangre sale por el corte y no por el lomo', () => {
      const [l] = pageRects(getLayout('P1'), look({ bleed: true }), 'left', 105, 148, sp, 3);
      expect(l).toEqual({ x: -3, y: -3, w: 108, h: 154 });
      const [r] = pageRects(getLayout('P1'), look({ bleed: true }), 'right', 105, 148, sp, 3);
      expect(r).toEqual({ x: 105, y: -3, w: 108, h: 154 });
    });

    it('un 16:9 horizontal a sangre toca el corte por los lados y queda centrado en altura', () => {
      const [r] = pageRects(getLayout('R-16x9-h'), look({ bleed: true }), 'right', 105, 148, sp, 3);
      expect(r.x).toBe(105);
      expect(r.w).toBeCloseTo(105 + 3);
      expect(r.h).toBeCloseTo((105 * 9) / 16);
      expect(r.y + r.h / 2).toBeCloseTo(74);
      // arriba: ahora también sangra por arriba
      const [top] = pageRects(getLayout('R-16x9-h'), look({ bleed: true, align: 'start' }), 'right', 105, 148, sp, 3);
      expect(top.y).toBe(-3);
      expect(top.h).toBeCloseTo((105 * 9) / 16 + 3);
    });

    it('el tamaño reduce desde la caja de márgenes y la posición alinea en vertical', () => {
      const box = marginBox('left', 105, 148, sp);
      const [half] = pageRects(getLayout('P1'), look({ scale: 0.5 }), 'left', 105, 148, sp, 0);
      expect(half.w).toBeCloseTo(box.w / 2);
      expect(half.h).toBeCloseTo(box.h / 2);
      expect(half.x + half.w / 2).toBeCloseTo(box.x + box.w / 2);
      const [low] = pageRects(getLayout('P1'), look({ scale: 0.5, align: 'end' }), 'left', 105, 148, sp, 0);
      expect(low.y + low.h).toBeCloseTo(box.y + box.h);
      expect(verticalSlack(getLayout('P1'), look({}), 'left', 105, 148, sp)).toBeCloseTo(0);
    });

    it('una rejilla a sangre conserva la separación y sangra solo por fuera', () => {
      const rects = pageRects(getLayout('P4-grid'), look({ bleed: true }), 'right', 105, 148, sp, 3);
      expect(rects[0].x).toBe(105); // lomo
      expect(rects[1].x + rects[1].w).toBeCloseTo(213);
      expect(rects[1].x - (rects[0].x + rects[0].w)).toBeCloseTo(3);
      expect(rects[0].y).toBe(-3);
      expect(rects[2].y + rects[2].h).toBeCloseTo(151);
    });

    it('convierte las plantillas antiguas sin perder las fotos', () => {
      const frames = [{ slot: 0, photoId: 'x', fit: 'cover' as const, offsetX: 0.1, offsetY: 0, scale: 1.2, rotation: 0 as const, flipX: false }];
      expect(upgradePage({ layoutId: 'P1-full', frames })).toEqual({ layoutId: 'P1', frames, bleed: true, scale: 1, align: 'center' });
      expect(pageLook({ layoutId: 'P1-centro', frames: [] }).scale).toBe(0.6);
      expect(upgradePage({ layoutId: 'P1-arriba', frames: [] })).toMatchObject({ layoutId: 'R-5x4-v', align: 'start' });
      expect(upgradePage({ layoutId: 'P2-v', frames: [] })).toEqual({ layoutId: 'P2-v', frames: [] });
      const b = newBooklet('x', 'a6');
      b.cover.full = { layoutId: 'D1-pano-margen', frames: [] };
      expect(upgradeBooklet(b).cover.full).toMatchObject({ layoutId: 'D1', bleed: false });
    });
  });
});
