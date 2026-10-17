import { memo } from 'react';
import { layoutBox, surfacePages, type SurfacePage } from '../model/geometry';
import type { Booklet, Layout, Photo, SurfaceKey } from '../model/types';
import { PhotoImg } from './PhotoImg';
import { FrameView } from './FrameView';
import { useEditor } from '../store/editor';

interface Props {
  booklet: Booklet;
  surface: SurfaceKey;
  /** px por mm */
  k: number;
  photos: Map<string, Photo>;
  interactive?: boolean;
  guides?: boolean;
  thumb?: boolean;
}

const NO_BLEED = { bleed: false } as Layout;

function SurfaceViewImpl({ booklet, surface, k, photos, interactive, guides, thumb }: Props) {
  const { w, h } = booklet.pageSize;
  const pages = surfacePages(booklet, surface);
  const sel = useEditor((s) => (interactive ? s.sel : null));
  const select = useEditor((s) => s.select);
  const full = pages[0]?.page === 'full';

  const pageBg = (p: SurfacePage) => {
    const x = p.page === 'right' ? w : 0;
    const width = p.page === 'full' ? 2 * w : w;
    const active = interactive && sel?.surface === surface && sel.page === p.page;
    return (
      <div
        key={`bg-${p.page}`}
        className={`absolute ${p.blank ? 'paper-blank' : ''} ${active ? 'outline-2 -outline-offset-2 outline-orange-300' : ''}`}
        style={{ left: x * k, top: 0, width: width * k, height: h * k }}
        onClick={interactive ? () => select({ surface, page: p.page, slot: null }) : undefined}
      >
        {p.blank && !thumb && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-stone-500">
            En blanco · la cubierta va en cartulina
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,.15),0_8px_24px_rgba(0,0,0,.08)]" style={{ width: 2 * w * k, height: h * k }}>
      {pages.map(pageBg)}

      {guides &&
        pages.map((p) => {
          if (p.blank) return null;
          const r = layoutBox(NO_BLEED, p.page, w, h, p.spacing, booklet.bleed);
          return (
            <div
              key={`g-${p.page}`}
              className="pointer-events-none absolute border border-dashed border-sky-400/60"
              style={{ left: r.x * k, top: r.y * k, width: r.w * k, height: r.h * k }}
            />
          );
        })}

      {pages.flatMap((p) =>
        p.frames.map((pf) => {
          const photo = pf.frame.photoId ? photos.get(pf.frame.photoId) : undefined;
          if (interactive) return <FrameView key={`${p.page}-${pf.slot}`} pf={pf} k={k} photo={photo} />;
          return (
            <div
              key={`${p.page}-${pf.slot}`}
              className={`absolute overflow-hidden ${photo ? '' : thumb ? 'bg-stone-200' : ''}`}
              style={{ left: pf.rect.x * k, top: pf.rect.y * k, width: pf.rect.w * k, height: pf.rect.h * k }}
            >
              {photo && <PhotoImg rect={pf.rect} k={k} photo={photo} frame={pf.frame} kind={thumb ? 'thumb' : 'preview'} />}
            </div>
          );
        }),
      )}

      {/* pliegue */}
      <div
        className={`pointer-events-none absolute top-0 h-full ${full ? 'border-l border-dashed border-stone-400/50' : 'w-px bg-stone-300/80'}`}
        style={{ left: w * k }}
      />
      {!full && !thumb && (
        <div className="pointer-events-none absolute top-0 h-full w-6 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/[.04] to-transparent" style={{ left: w * k }} />
      )}
    </div>
  );
}

export const SurfaceView = memo(SurfaceViewImpl);
