import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { saveBooklet } from '../db/db';
import { photoUrl } from '../lib/photos';
import { getSurface } from '../model/geometry';
import { centerIndex, pageLabel } from '../model/imposition';
import type { FrameTarget, PageKey } from '../model/types';
import { redo, undo, useEditor } from '../store/editor';
import { ExportDialog } from './ExportDialog';
import { Flipbook } from './Flipbook';
import { Inspector } from './Inspector';
import { Strip } from './Strip';
import { SurfaceView } from './SurfaceView';
import { Tray } from './Tray';
import { Btn } from './ui';

export function Editor({ onClose }: { onClose(): void }) {
  const b = useEditor((s) => s.booklet)!;
  const photoList = useEditor((s) => s.photos);
  const photos = useMemo(() => new Map(photoList.map((p) => [p.id, p])), [photoList]);
  const canUndo = useStore(useEditor.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useEditor.temporal, (s) => s.futureStates.length > 0);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'export' | 'flip' | null>(null);
  const [saved, setSaved] = useState(true);

  // guardado automático local
  useEffect(() => {
    let t = 0;
    let pending: typeof b | null = null;
    const flush = () => {
      if (pending) saveBooklet(pending).then(() => setSaved(true));
      pending = null;
    };
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.booklet && s.booklet !== prev.booklet) {
        pending = s.booklet;
        setSaved(false);
        clearTimeout(t);
        t = window.setTimeout(flush, 500);
      }
    });
    return () => {
      unsub();
      clearTimeout(t);
      flush();
    };
  }, []);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, select');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
        const { sel, clearFrame } = useEditor.getState();
        if (sel.slot != null) clearFrame({ surface: sel.surface, page: sel.page, slot: sel.slot });
      } else if (e.key === 'Escape') {
        useEditor.getState().arm(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current?.photoId as string) ?? null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const st = useEditor.getState();
    const data = active.data.current as { kind: 'photo' | 'frame'; photoId?: string; target?: FrameTarget } | undefined;
    if (!over || !data) return;
    if (over.id === 'tray') {
      if (data.kind === 'frame' && data.target) st.clearFrame(data.target);
      return;
    }
    const target = over.data.current?.target as FrameTarget | undefined;
    if (!target) return;
    if (data.kind === 'photo' && data.photoId) st.placePhotoIn(target, data.photoId);
    if (data.kind === 'frame' && data.target) st.swapFrames(data.target, target);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)} autoScroll={false}>
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b border-stone-200 bg-white/70 px-3 py-2 backdrop-blur">
          <Btn onClick={onClose} title="Volver a la lista">
            ← <span className="hidden sm:inline">Libritos</span>
          </Btn>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-lg leading-tight">{b.title || 'Sin título'}</h1>
            <p className="text-[11px] text-stone-500">{saved ? 'Guardado en este navegador' : 'Guardando…'}</p>
          </div>
          <Btn onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">
            ↶
          </Btn>
          <Btn onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Shift+Z)">
            ↷
          </Btn>
          <Btn variant="outline" onClick={() => setDialog('flip')}>
            Hojear
          </Btn>
          <Btn variant="primary" onClick={() => setDialog('export')}>
            Exportar PDF
          </Btn>
        </header>

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

      <DragOverlay dropAnimation={null}>
        {dragging && <img src={photoUrl(dragging, 'thumb')} alt="" className="h-20 w-20 rounded-md object-cover opacity-90 shadow-xl" />}
      </DragOverlay>

      {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} />}
      {dialog === 'flip' && <Flipbook photos={photos} onClose={() => setDialog(null)} />}
    </DndContext>
  );
}

function TrayDrop({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'tray' });
  return (
    <aside
      ref={setNodeRef}
      className={`order-2 max-h-44 border-stone-200 bg-white/60 md:order-none md:max-h-none md:w-56 md:border-r ${isOver ? 'ring-2 ring-orange-400 ring-inset' : ''}`}
    >
      {children}
    </aside>
  );
}

function Canvas({ photos }: { photos: Map<string, import('../model/types').Photo> }) {
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
