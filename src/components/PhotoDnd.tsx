import { useEffect, useState, type ReactNode } from 'react';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { saveBooklet } from '../db/db';
import { isForcedBlank } from '../model/imposition';
import { photoUrl } from '../lib/photos';
import type { AnyTarget } from '../model/types';
import { isZineTarget } from '../model/types';
import { redo, undo, useEditor } from '../store/editor';

/** Arrastrar fotos de la bandeja a los recuadros y entre recuadros; soltar en la bandeja las quita. */
export function PhotoDnd({ children }: { children: ReactNode }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current?.photoId as string) ?? null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const st = useEditor.getState();
    const data = active.data.current as { kind: 'photo' | 'frame'; photoId?: string; target?: AnyTarget } | undefined;
    if (!over || !data) return;
    if (over.id === 'tray') {
      if (data.kind === 'frame' && data.target) st.clearFrame(data.target);
      return;
    }
    const target = over.data.current?.target as AnyTarget | undefined;
    if (!target) return;
    if (data.kind === 'photo' && data.photoId) st.placePhotoIn(target, data.photoId);
    if (data.kind === 'frame' && data.target) st.swapFrames(data.target, target);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)} autoScroll={false}>
      {children}
      <DragOverlay dropAnimation={null}>
        {dragging && <img src={photoUrl(dragging, 'thumb')} alt="" className="h-20 w-20 rounded-md object-cover opacity-90 shadow-xl" />}
      </DragOverlay>
    </DndContext>
  );
}

export function TrayDrop({ children }: { children: ReactNode }) {
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

/** Guardado automático local y atajos de teclado. Devuelve si está todo guardado. */
export function useEditorChrome(): boolean {
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    let t = 0;
    let pending: Parameters<typeof saveBooklet>[0] | null = null;
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
      } else if (mod && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'v') && !typing && !window.getSelection()?.toString()) {
        // copiar y pegar el diseño de la página seleccionada
        const { sel, booklet, copyStyle, pasteStyle } = useEditor.getState();
        if (!booklet || booklet.kind === 'zine') return;
        if (sel.page !== 'full' && isForcedBlank(booklet, sel.surface, sel.page)) return;
        e.preventDefault();
        if (e.key.toLowerCase() === 'c') copyStyle(sel.surface, sel.page);
        else pasteStyle(sel.surface, sel.page);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
        const { sel, zsel, booklet, clearFrame } = useEditor.getState();
        if (booklet?.kind === 'zine') {
          if (zsel != null) clearFrame({ zine: zsel });
        } else if (sel.slot != null) clearFrame({ surface: sel.surface, page: sel.page, slot: sel.slot });
      } else if (e.key === 'Escape') {
        useEditor.getState().arm(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return saved;
}

export { isZineTarget };
