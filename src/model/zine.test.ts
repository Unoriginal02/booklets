import { describe, expect, it } from 'vitest';
import { frameInPage, getZineMethod, pagesText, pageSizeOf, simulate, ZINE_BLEED, ZINE_METHODS, zineFrameRect, type ZinePanel } from './zine';

const grid = (id: string, side: 0 | 1) => {
  const ps = getZineMethod(id).panels.filter((p) => p.side === side);
  const rows = [...new Set(ps.map((p) => p.rect.y))].sort((a, b) => a - b);
  return rows.map((y) =>
    ps
      .filter((p) => p.rect.y === y)
      .sort((a, b) => a.rect.x - b.rect.x)
      .map((p) => (p.rot ? `${p.num}↓` : `${p.num}`)),
  );
};

describe('métodos de fanzine', () => {
  for (const m of ZINE_METHODS) {
    it(`${m.id}: cada página aparece una vez y la hoja queda cubierta`, () => {
      const nums = m.panels.map((p) => p.num).sort((a, b) => a - b);
      expect(nums).toEqual(Array.from({ length: m.pages }, (_, i) => i + 1));
      for (const side of m.sides === 2 ? [0, 1] : [0]) {
        const area = m.panels.filter((p) => p.side === side).reduce((a, p) => a + p.rect.w * p.rect.h, 0);
        expect(area).toBeCloseTo(m.trim.w * m.trim.h);
      }
      expect(m.panels.find((p) => p.num === 1)!.side).toBe(0);
    });
  }

  it('el cuadernillo de 16 coincide con la imposición clásica de imprenta', () => {
    expect(grid('cuadernillo-16', 0)).toEqual([
      ['5↓', '12↓', '9↓', '8↓'],
      ['4', '13', '16', '1'],
    ]);
    expect(grid('cuadernillo-16', 1)).toEqual([
      ['7↓', '10↓', '11↓', '6↓'],
      ['2', '15', '14', '3'],
    ]);
  });

  it('cuadernillo de 8, doblez francés y minizine', () => {
    expect(grid('cuadernillo-8', 0)).toEqual([['5↓', '4↓'], ['8', '1']]);
    expect(grid('cuadernillo-8', 1)).toEqual([['3↓', '6↓'], ['2', '7']]);
    expect(grid('frances-4', 0)).toEqual([['3↓', '2↓'], ['4', '1']]);
    expect(grid('minizine-8', 0)).toEqual([
      ['5↓', '4↓', '3↓', '2↓'],
      ['6', '7', '8', '1'],
    ]);
  });

  it('en los cuadernillos, cada hoja lleva sus dos páginas espalda con espalda', () => {
    for (const id of ['cuadernillo-16', 'cuadernillo-8', 'cuadernillo-apaisado-8', 'micro-32']) {
      const m = getZineMethod(id);
      const at = (n: number) => m.panels.find((p) => p.num === n)!;
      for (let n = 1; n < m.pages; n += 2) {
        const a = at(n);
        const b = at(n + 1);
        expect(a.side).not.toBe(b.side);
        // el reverso se ve volteado de izquierda a derecha
        expect(b.rect.x).toBeCloseTo(m.trim.w - a.rect.x - a.rect.w);
        expect(b.rect.y).toBeCloseTo(a.rect.y);
        expect(b.rot).toBe(a.rot);
      }
    }
  });

  it('en el doblez francés las caras en blanco quedan dentro', () => {
    const r = simulate(2, 2, 180, 270, [
      { axis: 'y', keep: 'high', over: false },
      { axis: 'x', keep: 'low', over: false },
    ]);
    expect(r.faces.filter((f) => f.side === 'A').map((f) => f.page)).toEqual([1, 4, 5, 8]);
  });

  it('en el minizine las dobles son paneles vecinos en el orden de lectura', () => {
    const m = getZineMethod('minizine-8');
    const at = (n: number) => m.panels.find((p) => p.num === n)!;
    for (const [l, r] of [[2, 3], [4, 5], [6, 7]]) {
      const a = at(l);
      const b = at(r);
      expect(a.rect.y).toBe(b.rect.y);
      expect(Math.abs(a.rect.x - b.rect.x)).toBeCloseTo(a.rect.w);
      // girada 180°, la página izquierda de la doble está a la derecha en la hoja
      expect(a.rot === 180 ? a.rect.x > b.rect.x : a.rect.x < b.rect.x).toBe(true);
    }
  });

  it('a sangre, el recuadro sale 3 mm por los bordes de corte y no por los dobleces', () => {
    const m = getZineMethod('minizine-8');
    const corner = m.panels.find((p) => p.num === 1)!; // abajo a la derecha
    const r = zineFrameRect(m, corner, 0);
    expect(r).toEqual({ x: corner.rect.x, y: corner.rect.y, w: corner.rect.w + ZINE_BLEED, h: corner.rect.h + ZINE_BLEED });
    const inPage = frameInPage(corner, r);
    expect(inPage).toEqual({ x: 0, y: 0, w: corner.rect.w + ZINE_BLEED, h: corner.rect.h + ZINE_BLEED });
    // girada 180°, el sangrado de arriba en la hoja es el de abajo en la página
    const top: ZinePanel = m.panels.find((p) => p.num === 2)!; // arriba a la derecha, cabeza abajo
    const rt = zineFrameRect(m, top, 0);
    expect(frameInPage(top, rt)).toEqual({ x: -ZINE_BLEED, y: 0, w: top.rect.w + ZINE_BLEED, h: top.rect.h + ZINE_BLEED });
  });

  it('el cuadernillo apaisado tiene páginas horizontales y el microlibro, verticales', () => {
    const at = (id: string) => pageSizeOf(getZineMethod(id).panels[0]);
    expect(at('cuadernillo-apaisado-8')).toEqual({ w: 135, h: 90 });
    expect(at('micro-32')).toEqual({ w: 45, h: 67.5 });
    expect(getZineMethod('micro-32').pages).toBe(32);
  });

  it('el minizine con póster es el minizine más la hoja entera por detrás', () => {
    const m = getZineMethod('minizine-poster');
    expect(grid('minizine-poster', 0)).toEqual(grid('minizine-8', 0));
    expect(m.panels.filter((p) => p.side === 1)).toEqual([expect.objectContaining({ num: 9, rect: { x: 0, y: 0, w: m.trim.w, h: m.trim.h } })]);
    expect(pagesText(m)).toBe('8 páginas + póster');
  });

  it('a dos voces, la segunda mitad va girada respecto al minizine', () => {
    const mini = getZineMethod('minizine-8');
    const two = getZineMethod('dos-voces-8');
    for (const p of two.panels) {
      const q = mini.panels.find((x) => x.num === p.num)!;
      expect(p.rect).toEqual(q.rect);
      expect(p.rot).toBe(p.num >= 5 ? (q.rot + 180) % 360 : q.rot);
    }
    expect(two.panels.find((p) => p.num === 8)!.name).toBe('Portada B');
  });
});
