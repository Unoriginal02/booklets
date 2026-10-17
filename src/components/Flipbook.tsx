import { useEffect, useMemo, useState } from 'react';
import { paddedBooklet, useEditor } from '../store/editor';
import type { Photo, SurfaceKey } from '../model/types';
import { SurfaceView } from './SurfaceView';
import { Btn } from './ui';

type View = { surface: SurfaceKey; half?: 'left' | 'right'; label: string };

/** Vista de hojeo: el librito tal como quedará, incluida la doble de relleno si hace falta. */
export function Flipbook({ photos, onClose }: { photos: Map<string, Photo>; onClose(): void }) {
  const original = useEditor((s) => s.booklet)!;
  const b = useMemo(() => paddedBooklet(original), [original]);
  const padded = b.spreads.length !== original.spreads.length;
  const views: View[] = useMemo(
    () => [
      { surface: 'cover', half: 'right', label: 'Portada' },
      ...b.spreads.map((sp, i): View => ({
        surface: i,
        label: padded && !original.spreads.includes(sp) ? `Doble ${i + 1} · en blanco, para cerrar la hoja` : `Doble ${i + 1}`,
      })),
      { surface: 'cover', half: 'left', label: 'Contraportada' },
    ],
    [b, original, padded],
  );
  const [i, setI] = useState(0);
  const [vw, setVw] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((x) => Math.min(views.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
      if (e.key === 'Escape') onClose();
    };
    const onResize = () => setVw({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [views.length, onClose]);

  const { w, h } = b.pageSize;
  const k = Math.min((vw.w - 48) / (2 * w), (vw.h - 160) / h);
  const v = views[i];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/90 text-white" onClick={onClose}>
      <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex" style={{ width: 2 * w * k, height: h * k }}>
          {v.half ? (
            <div className="absolute overflow-hidden" style={{ left: v.half === 'right' ? w * k : 0, width: w * k, height: h * k }}>
              <div style={{ marginLeft: v.half === 'right' ? -w * k : 0 }}>
                <SurfaceView booklet={b} surface={v.surface} k={k} photos={photos} />
              </div>
            </div>
          ) : (
            <SurfaceView booklet={b} surface={v.surface} k={k} photos={photos} />
          )}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <Btn className="text-white hover:bg-white/10" disabled={i === 0} onClick={() => setI(i - 1)}>
            ← Anterior
          </Btn>
          <span className="min-w-48 text-center text-sm text-stone-300">
            {v.label} <span className="text-stone-500">· {i + 1}/{views.length}</span>
          </span>
          <Btn className="text-white hover:bg-white/10" disabled={i === views.length - 1} onClick={() => setI(i + 1)}>
            Siguiente →
          </Btn>
        </div>
        <Btn className="mt-2 text-stone-400 hover:bg-white/10" onClick={onClose}>
          Cerrar
        </Btn>
      </div>
    </div>
  );
}
