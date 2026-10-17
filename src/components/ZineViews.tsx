import { useEditor } from '../store/editor';
import { frameInPage, getZineMethod, linesFor, pageSizeOf, zineFrames, type ZineMethod, type ZinePanel } from '../model/zine';
import type { Booklet, Photo } from '../model/types';
import { FrameView } from './FrameView';
import { PhotoImg } from './PhotoImg';

/** Número y nombre de la página, girados con ella: así se ve qué foto va boca abajo. */
function PanelLabel({ panel, k }: { panel: ZinePanel; k: number }) {
  const big = Math.max(14, Math.min(34, panel.rect.w * k * 0.16));
  return (
    <>
      <div className="absolute top-1.5 left-1.5 flex items-baseline gap-1.5 rounded bg-white/85 px-1.5 py-0.5 text-stone-800 shadow-sm">
        <span className="font-serif leading-none font-semibold tabular-nums" style={{ fontSize: big }}>
          {panel.num}
        </span>
        <span className="max-w-28 truncate text-[10px] leading-tight">{panel.name}</span>
      </div>
      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] leading-none text-stone-500/80" title="Parte de arriba de la página">
        ▲
      </div>
    </>
  );
}

interface SheetProps {
  booklet: Booklet;
  method: ZineMethod;
  side: 0 | 1;
  k: number;
  photos: Map<string, Photo>;
  interactive?: boolean;
  guides?: boolean;
}

/** Una cara de la hoja tal como se imprime, con cada panel numerado. */
export function ZineSheet({ booklet, method, side, k, photos, interactive, guides }: SheetProps) {
  const zsel = useEditor((s) => (interactive ? s.zsel : null));
  const frames = zineFrames(booklet, side);
  const { w, h } = method.trim;
  return (
    <div className="relative overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,.15),0_8px_24px_rgba(0,0,0,.08)]" style={{ width: w * k, height: h * k }}>
      {frames.map((z) => {
        const photo = z.frame.photoId ? photos.get(z.frame.photoId) : undefined;
        if (interactive)
          return (
            <FrameView
              key={z.panel.num}
              target={z.target}
              rect={z.rect}
              rotation={z.panel.rot}
              k={k}
              frame={z.frame}
              photo={photo}
              selected={zsel === z.panel.num}
              overlay={<PanelLabel panel={z.panel} k={k} />}
            />
          );
        return (
          <div key={z.panel.num} className="absolute overflow-hidden" style={{ left: z.rect.x * k, top: z.rect.y * k, width: z.rect.w * k, height: z.rect.h * k }}>
            <div className="absolute top-1/2 left-1/2" style={{ width: z.size.w * k, height: z.size.h * k, transform: `translate(-50%, -50%) rotate(${z.panel.rot}deg)` }}>
              {photo && <PhotoImg rect={z.size} k={k} photo={photo} frame={z.frame} />}
            </div>
          </div>
        );
      })}
      {guides && (
        <svg className="pointer-events-none absolute inset-0" width={w * k} height={h * k}>
          {linesFor(method, side).map((l, i) => (
            <line
              key={i}
              x1={l.x1 * k}
              y1={l.y1 * k}
              x2={l.x2 * k}
              y2={l.y2 * k}
              stroke={l.kind === 'cut' ? '#dc2626' : '#0ea5e9'}
              strokeWidth={l.kind === 'cut' ? 2.5 : 1.5}
              strokeDasharray={l.kind === 'cut' ? undefined : '6 4'}
            />
          ))}
        </svg>
      )}
    </div>
  );
}

/** Las páginas en orden de lectura y del derecho: así quedará el fanzine doblado. */
export function FoldedPreview({ booklet, photos, height }: { booklet: Booklet; photos: Map<string, Photo>; height: number }) {
  const frames = zineFrames(booklet).sort((a, b) => a.panel.num - b.panel.num);
  const poster = getZineMethod(booklet.zine?.methodId).poster;
  const maxH = Math.max(...frames.filter((z) => z.panel.num !== poster).map((z) => pageSizeOf(z.panel).h));
  const pageK = height / maxH;
  return (
    <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-6">
      {frames.map((z) => {
        const page = pageSizeOf(z.panel);
        // el póster es la hoja entera: se muestra algo mayor que una página, no a escala
        const k = z.panel.num === poster ? (1.4 * height) / page.h : pageK;
        const inner = frameInPage(z.panel, z.rect);
        const photo = z.frame.photoId ? photos.get(z.frame.photoId) : undefined;
        return (
          <figure key={z.panel.num} className="flex flex-col items-center gap-1.5">
            <div className="relative overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,.15)]" style={{ width: page.w * k, height: page.h * k }}>
              <div className={`absolute overflow-hidden ${photo ? '' : 'bg-stone-100'}`} style={{ left: inner.x * k, top: inner.y * k, width: inner.w * k, height: inner.h * k }}>
                {photo && <PhotoImg rect={z.size} k={k} photo={photo} frame={z.frame} />}
              </div>
            </div>
            <figcaption className="text-[11px] text-stone-600">
              <b className="tabular-nums">{z.panel.num}</b> · {z.panel.name}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/** Miniatura del método: las caras con sus paneles numerados, girados como en la hoja. */
export function MethodIcon({ method, height = 54 }: { method: ZineMethod; height?: number }) {
  const { w, h } = method.trim;
  const k = height / h;
  const sides: (0 | 1)[] = method.sides === 2 ? [0, 1] : [0];
  // el mismo tamaño de número en todos los paneles
  const size = Math.min(...method.panels.map((p) => Math.min(p.rect.w, p.rect.h))) * 0.42;
  return (
    <div className="flex gap-1.5">
      {sides.map((side) => (
        <svg key={side} width={w * k} height={h * k} viewBox={`0 0 ${w} ${h}`} className="block shrink-0">
          <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="white" stroke="#a8a29e" strokeWidth={1.5} />
          {method.panels
            .filter((p) => p.side === side)
            .map((p) => {
              const cx = p.rect.x + p.rect.w / 2;
              const cy = p.rect.y + p.rect.h / 2;
              return (
                <g key={p.num}>
                  <rect x={p.rect.x} y={p.rect.y} width={p.rect.w} height={p.rect.h} fill={p.num === 1 ? '#fed7aa' : p.num === method.poster ? '#e7e5e4' : 'transparent'} stroke="#d6d3d1" strokeWidth={1} />
                  <text x={cx} y={cy} transform={`rotate(${p.rot} ${cx} ${cy})`} textAnchor="middle" dominantBaseline="central" fontSize={size} fontFamily="Georgia, serif" fill="#44403c">
                    {p.num}
                  </text>
                </g>
              );
            })}
          {linesFor(method, side)
            .filter((l) => l.kind === 'cut')
            .map((l, i) => (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#dc2626" strokeWidth={3} />
            ))}
        </svg>
      ))}
    </div>
  );
}

export function MethodCard({ method, active, onClick }: { method: ZineMethod; active?: boolean; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition ${active ? 'border-orange-600 bg-orange-50' : 'border-stone-200 bg-white hover:border-stone-400'}`}
    >
      <MethodIcon method={method} />
      <div>
        <p className="text-sm font-semibold text-stone-900">{method.name}</p>
        <p className="text-xs text-stone-600">{method.summary}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {method.tags.map((t) => (
          <span key={t} className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}
