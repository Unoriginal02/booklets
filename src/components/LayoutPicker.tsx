import { useState } from 'react';
import { layoutToRects } from '../model/geometry';
import { getLayout, parseRatioLayout, RATIO_GROUPS, RATIOS, ratioLabel, ratioLayoutId, SPREAD_RATIOS, type Orientation } from '../model/layouts';
import { Seg } from './ui';
import type { Layout } from '../model/types';

interface Props {
  layouts: Layout[];
  value: string;
  onChange(id: string): void;
  /** ancho/alto de la superficie que representa el icono */
  aspect: number;
  names?: Record<string, string>;
}

export function LayoutIcon({ layout, aspect, spread }: { layout: Layout; aspect: number; spread: boolean }) {
  const H = 40;
  const W = H * aspect;
  const m = layout.bleed ? 0 : 3.5;
  const rects = layoutToRects(layout, { x: m, y: m, w: W - 2 * m, h: H - 2 * m }, 1.6);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="white" stroke="#d6d3d1" />
      {spread && <line x1={W / 2} x2={W / 2} y1={0} y2={H} stroke="#e7e5e4" />}
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#a8a29e" />
      ))}
    </svg>
  );
}

export function LayoutPicker({ layouts, value, onChange, aspect, names }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {layouts.map((l) => (
        <button
          key={l.id}
          title={names?.[l.id] ?? l.name}
          onClick={() => onChange(l.id)}
          className={`rounded p-1 transition ${value === l.id ? 'bg-orange-100 ring-2 ring-orange-500' : 'hover:bg-stone-200'}`}
        >
          <LayoutIcon layout={l} aspect={aspect} spread={l.scope === 'spread'} />
        </button>
      ))}
    </div>
  );
}

/**
 * Recuadro único con una proporción fija, centrado y lo mayor posible dentro de los márgenes.
 * En una página, el interruptor lo cambia entre vertical y horizontal; la foto que ya
 * estaba dentro no se gira, solo se vuelve a encuadrar. En la doble central solo hay
 * horizontales, que cruzan el pliegue.
 */
export function RatioPicker({
  value,
  onChange,
  aspect,
  scope = 'page',
}: {
  value: string;
  onChange(id: string): void;
  aspect: number;
  scope?: 'page' | 'spread';
}) {
  const spread = scope === 'spread';
  const cur = parseRatioLayout(value);
  const [orient, setOrient] = useState<Orientation>(aspect < 1 ? 'v' : 'h');
  const o: Orientation = spread ? 'h' : (cur?.o ?? orient);
  const list = spread ? SPREAD_RATIOS : RATIOS;

  const setO = (next: Orientation) => {
    setOrient(next);
    if (cur?.o && cur.o !== next) onChange(ratioLayoutId(cur.ratioId, next));
  };

  return (
    <div className="mt-3 border-t border-stone-200 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-stone-500">{spread ? 'Proporción centrada en la doble' : 'Proporción centrada'}</span>
        {!spread && (
          <div className="w-44">
            <Seg<Orientation>
              value={o}
              onChange={setO}
              options={[
                { value: 'v', label: 'Vertical' },
                { value: 'h', label: 'Horizontal' },
              ]}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {RATIO_GROUPS.map((g) => {
          const items = list.filter((r) => r.group === g.id);
          if (!items.length) return null;
          return (
            <div key={g.id}>
              <p className="mb-1 text-[10px] tracking-wider text-stone-400 uppercase">{g.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((r) => {
                  const id = ratioLayoutId(r.id, o, scope);
                  return (
                    <button
                      key={r.id}
                      title={r.note}
                      onClick={() => onChange(id)}
                      className={`flex flex-col items-center gap-0.5 rounded p-1 transition ${cur?.ratioId === r.id ? 'bg-orange-100 ring-2 ring-orange-500' : 'hover:bg-stone-200'}`}
                    >
                      <LayoutIcon layout={getLayout(id)} aspect={aspect} spread={spread} />
                      <span className="text-[10px] text-stone-600 tabular-nums">{ratioLabel(r, o)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
