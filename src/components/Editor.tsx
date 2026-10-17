import { useEffect, useMemo, useRef, useState } from 'react';
import { getSurface } from '../model/geometry';
import { centerIndex, pageLabel } from '../model/imposition';
import type { PageKey, Photo } from '../model/types';
import { useEditor } from '../store/editor';
import { EditorHeader } from './EditorHeader';
import { ExportDialog } from './ExportDialog';
import { Flipbook } from './Flipbook';
import { Inspector } from './Inspector';
import { PhotoDnd, TrayDrop, useEditorChrome } from './PhotoDnd';
import { Strip } from './Strip';
import { SurfaceView } from './SurfaceView';
import { Tray } from './Tray';
import { Btn } from './ui';

export function Editor({ onClose }: { onClose(): void }) {
  const b = useEditor((s) => s.booklet)!;
  const photoList = useEditor((s) => s.photos);
  const photos = useMemo(() => new Map(photoList.map((p) => [p.id, p])), [photoList]);
  const [dialog, setDialog] = useState<'export' | 'flip' | null>(null);
  const saved = useEditorChrome();

  // la selección siempre apunta a algo que existe
  const sel = useEditor((s) => s.sel);
  useEffect(() => {
    const { select } = useEditor.getState();
    if (typeof sel.surface === 'number' && sel.surface >= b.spreads.length) return select({ surface: b.spreads.length - 1, page: 'left', slot: null });
    const s = getSurface(b, sel.surface);
    if (!s) return;
    if (s.mode === 'full' && sel.page !== 'full') select({ page: 'full', slot: null });
    if (s.mode === 'pages' && sel.page === 'full') select({ page: sel.surface === 'cover' ? 'right' : 'left', slot: null });
  }, [b, sel]);

  return (
    <PhotoDnd>
      <div className="flex h-full flex-col">
        <EditorHeader saved={saved} onClose={onClose} onExport={() => setDialog('export')}>
          <Btn variant="outline" onClick={() => setDialog('flip')}>
            Hojear
          </Btn>
        </EditorHeader>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <TrayDrop>
            <Tray />
          </TrayDrop>
          <main className="flex min-h-[55vh] min-w-0 flex-1 flex-col md:min-h-0">
            <Canvas photos={photos} />
            <Strip photos={photos} />
          </main>
          <aside className="order-3 overflow-y-auto border-stone-200 bg-white/60 md:w-80 md:border-l">
            <Inspector />
          </aside>
        </div>
      </div>

      {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} />}
      {dialog === 'flip' && <Flipbook photos={photos} onClose={() => setDialog(null)} />}
    </PhotoDnd>
  );
}

function Canvas({ photos }: { photos: Map<string, Photo> }) {
  const b = useEditor((s) => s.booklet)!;
  const sel = useEditor((s) => s.sel);
  const guides = useEditor((s) => s.showGuides);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });

  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = b.pageSize;
  const k = Math.max(0.5, Math.min((size.w - 40) / (2 * w), (size.h - 70) / h));
  const s = getSurface(b, sel.surface);
  const n = b.spreads.length;
  const center = centerIndex(n);
  const labels: PageKey[] = s?.mode === 'full' ? ['full'] : ['left', 'right'];

  return (
    <div
      ref={ref}
      className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden"
      onClick={(e) => e.target === e.currentTarget && useEditor.getState().arm(null)}
    >
      {s && (
        <>
          <div className="mb-2 flex text-xs text-stone-500" style={{ width: 2 * w * k }}>
            {labels.map((p) => (
              <div key={p} className={`flex-1 ${p === 'left' ? 'text-left' : p === 'right' ? 'text-right' : 'text-center'}`}>
                {sel.surface === 'cover' && p === 'full' ? 'Contraportada · Portada' : pageLabel(n, sel.surface, p)}
                {p === 'full' && sel.surface === center && ' · doble central'}
              </div>
            ))}
          </div>
          <SurfaceView booklet={b} surface={sel.surface} k={k} photos={photos} interactive guides={guides} />
          <p className="mt-2 text-[11px] text-stone-400">
            {sel.surface === 'cover' ? 'Cubierta vista por fuera, extendida' : sel.surface === center ? 'Doble central: aquí puedes poner una foto que cruce el pliegue' : ' '}
          </p>
        </>
      )}
    </div>
  );
}
