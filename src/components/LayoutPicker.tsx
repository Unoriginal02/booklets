import { useState, type ReactNode } from 'react';
import { contentBox, layoutToRects, verticalSlack } from '../model/geometry';
import { getLayout, MIN_LOOK_SCALE, MULTI_LAYOUTS, PAGE_FILL, pageLook, parseRatioLayout, RATIO_GROUPS, RATIOS, ratioLabel, ratioLayoutId, SPREAD_RATIOS, type Orientation } from '../model/layouts';
import { merging } from '../store/editor';
import { Seg } from './ui';
import type { Align, Layout, Look, Page, PageKey, Spacing } from '../model/types';

/** Miniatura de una plantilla con el tamaño y la posición que tiene ahora la página. */
export function LayoutIcon({ layout, look, aspect, spread }: { layout: Layout; look: Look; aspect: number; spread: boolean }) {
  const H = 40;
  const W = H * aspect;
  const m = 3.5;
  const avail = look.bleed ? { x: 0, y: 0, w: W, h: H } : { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
  const rects = layoutToRects(layout, contentBox(avail, layout.aspect, look), 1.6);
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

function Tile({ active, title, onClick, label, children }: { active: boolean; title: string; onClick(): void; label?: string; children: ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded p-1 transition ${active ? 'bg-orange-100 ring-2 ring-orange-500' : 'hover:bg-stone-200'}`}
    >
      {children}
      {label && <span className="text-[10px] text-stone-600 tabular-nums">{label}</span>}
    </button>
  );
}

function Group({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-3 border-t border-stone-200 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-stone-600">{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

const Sub = ({ children }: { children: ReactNode }) => <p className="mb-1 text-[10px] tracking-wider text-stone-400 uppercase">{children}</p>;

interface Props {
  scope: 'page' | 'spread';
  page: Page;
  pageKey: PageKey;
  /** tamaño de una página, en mm */
  pageW: number;
  pageH: number;
  spacing: Spacing;
  /** nombre de la foto que ocupa toda la superficie: Página, Doble, Envolvente */
  fillLabel: string;
  /** para fundir en un paso del historial los cambios seguidos del deslizador */
  historyKey: string;
  onLayout(id: string): void;
  onLook(patch: Partial<Look>): void;
}

/**
 * Qué se pone (una foto con una proporción, o varias) y cuánto ocupa (a sangre o una
 * fracción de la caja de márgenes), por separado. En una página, el interruptor cambia
 * las proporciones entre vertical y horizontal; la foto que ya estaba dentro no se gira,
 * solo se vuelve a encuadrar. En la doble solo hay horizontales, que cruzan el pliegue.
 */
export function CompositionPicker({ scope, page, pageKey, pageW, pageH, spacing, fillLabel, historyKey, onLayout, onLook }: Props) {
  const spread = scope === 'spread';
  const aspect = (spread ? 2 * pageW : pageW) / pageH;
  const { layout, ...look } = pageLook(page);
  const cur = parseRatioLayout(layout.id);
  const [orient, setOrient] = useState<Orientation>(aspect < 1 ? 'v' : 'h');
  const o: Orientation = spread ? 'h' : (cur?.o ?? orient);
  const ratios = spread ? SPREAD_RATIOS : RATIOS;
  const fill = getLayout(PAGE_FILL[scope]);
  const empty = layout.cells.length === 0;
  const canAlign = !empty && verticalSlack(layout, look, pageKey, pageW, pageH, spacing) > 0.5;

  const setO = (next: Orientation) => {
    setOrient(next);
    if (cur?.o && cur.o !== next) onLayout(ratioLayoutId(cur.ratioId, next));
  };

  const icon = (l: Layout) => <LayoutIcon layout={l} look={look} aspect={aspect} spread={spread} />;

  return (
    <div>
      {!empty && (
        <div className="flex flex-col gap-2 rounded-md bg-stone-100 p-2">
          <div className="flex items-center gap-2 text-[11px] text-stone-500">
            <span className="w-14">Tamaño</span>
            <div className="flex-1">
              <Seg<'bleed' | 'margin'>
                value={look.bleed ? 'bleed' : 'margin'}
                onChange={(v) => onLook({ bleed: v === 'bleed' })}
                options={[
                  { value: 'bleed', label: 'A sangre', title: 'Hasta el borde de la hoja, sin blanco alrededor' },
                  { value: 'margin', label: 'Al margen', title: 'Dentro de los márgenes, al tamaño que elijas' },
                ]}
              />
            </div>
          </div>
          {!look.bleed && (
            <label className="flex items-center gap-2 text-[11px] text-stone-500">
              <span className="w-14" />
              <input
                type="range"
                className="flex-1 accent-orange-700"
                min={MIN_LOOK_SCALE}
                max={1}
                step={0.05}
                value={look.scale}
                title="100 % = toca los márgenes"
                onChange={(e) => merging(`look:${historyKey}`, () => onLook({ scale: Number(e.target.value) }))}
              />
              <span className="w-9 text-right tabular-nums">{Math.round(look.scale * 100)}%</span>
            </label>
          )}
          <div className="flex items-center gap-2 text-[11px] text-stone-500">
            <span className="w-14">Posición</span>
            <div className="flex-1" title={canAlign ? undefined : 'Ya ocupa todo el alto: no hay sitio para moverla'}>
              <Seg<Align>
                value={look.align}
                onChange={(align) => onLook({ align })}
                options={[
                  { value: 'start', label: 'Arriba', disabled: !canAlign },
                  { value: 'center', label: 'Centro', disabled: !canAlign },
                  { value: 'end', label: 'Abajo', disabled: !canAlign },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      <Group
        title="Una foto"
        right={
          !spread && (
            <div className="w-40">
              <Seg<Orientation>
                value={o}
                onChange={setO}
                options={[
                  { value: 'v', label: 'Vertical' },
                  { value: 'h', label: 'Horizontal' },
                ]}
              />
            </div>
          )
        }
      >
        <div className="flex flex-col gap-2">
          <div>
            <Sub>{spread ? 'Doble' : 'Página'}</Sub>
            <Tile active={layout.id === fill.id} title={`Toda la ${spread ? 'doble' : 'página'}: su misma proporción`} onClick={() => onLayout(fill.id)} label={fillLabel}>
              {icon(fill)}
            </Tile>
          </div>
          {RATIO_GROUPS.map((g) => {
            const items = ratios.filter((r) => r.group === g.id);
            if (!items.length) return null;
            return (
              <div key={g.id}>
                <Sub>{g.name}</Sub>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((r) => {
                    const id = ratioLayoutId(r.id, o, scope);
                    return (
                      <Tile key={r.id} active={cur?.ratioId === r.id} title={r.note} onClick={() => onLayout(id)} label={ratioLabel(r, o)}>
                        {icon(getLayout(id))}
                      </Tile>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Group>

      <Group title="Varias fotos">
        <div className="flex flex-wrap gap-1.5">
          {MULTI_LAYOUTS[scope].map((l) => (
            <Tile key={l.id} active={layout.id === l.id} title={l.name} onClick={() => onLayout(l.id)} label={l.cells.length ? undefined : 'En blanco'}>
              {icon(l)}
            </Tile>
          ))}
        </div>
      </Group>
    </div>
  );
}
