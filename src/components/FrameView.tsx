import { useEffect, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useGesture } from '@use-gesture/react';
import { LOW_PPI, placePhoto, type PlacedFrame } from '../model/geometry';
import type { Frame, FrameTarget, Photo } from '../model/types';
import { useEditor } from '../store/editor';
import { PhotoImg } from './PhotoImg';

export const targetId = (t: FrameTarget) => `${t.surface}:${t.page}:${t.slot}`;

type Framing = Pick<Frame, 'offsetX' | 'offsetY' | 'scale'>;

interface Props {
  pf: PlacedFrame;
  k: number;
  photo?: Photo;
}

export function FrameView({ pf, k, photo }: Props) {
  const target: FrameTarget = { surface: pf.surface, page: pf.page, slot: pf.slot };
  const tid = targetId(target);
  const frame = pf.frame;
  const selected = useEditor((s) => s.sel.surface === pf.surface && s.sel.page === pf.page && s.sel.slot === pf.slot);
  const armed = useEditor((s) => s.armed);
  const { select, updateFrame, placePhotoIn } = useEditor.getState();

  const drop = useDroppable({ id: `drop:${tid}`, data: { target } });
  const drag = useDraggable({ id: `frame:${tid}`, data: { kind: 'frame', target, photoId: frame.photoId }, disabled: !frame.photoId });

  // durante el gesto se trabaja en local y se guarda al soltar: un solo paso de deshacer
  const [draft, setDraft] = useState<Framing | null>(null);
  const cur = { ...frame, ...draft };
  const ref = useRef<HTMLDivElement>(null);
  const wheelTimer = useRef<number>(0);
  const live = useRef(cur);
  live.current = cur;

  const clamp = (f: Framing): Framing => {
    if (!photo) return f;
    const pl = placePhoto(pf.rect, photo, { ...frame, ...f });
    return { offsetX: pl.offsetX, offsetY: pl.offsetY, scale: pl.scale };
  };
  const commit = (f: Framing) => {
    updateFrame(target, clamp(f));
    setDraft(null);
  };

  useEffect(() => () => clearTimeout(wheelTimer.current), []);

  useGesture(
    {
      onDrag: ({ movement: [mx, my], memo, first, last, event, cancel, pinching, tap }) => {
        if (tap) return;
        if (first && (event.target as Element).closest('[data-handle]')) return cancel();
        if (pinching) return cancel();
        const base: Framing = memo ?? { offsetX: live.current.offsetX, offsetY: live.current.offsetY, scale: live.current.scale };
        const next = clamp({ ...base, offsetX: base.offsetX + mx / (pf.rect.w * k), offsetY: base.offsetY + my / (pf.rect.h * k) });
        if (last) commit(next);
        else setDraft(next);
        return base;
      },
      onPinch: ({ movement: [ms], memo, last }) => {
        const base: Framing = memo ?? { offsetX: live.current.offsetX, offsetY: live.current.offsetY, scale: live.current.scale };
        const next = clamp({ ...base, scale: base.scale * ms });
        if (last) commit(next);
        else setDraft(next);
        return base;
      },
      onWheel: ({ delta: [, dy], event }) => {
        if (!selected) return;
        event.preventDefault();
        const next = clamp({ ...live.current, scale: live.current.scale * Math.exp(-dy * 0.0015) });
        setDraft(next);
        clearTimeout(wheelTimer.current);
        wheelTimer.current = window.setTimeout(() => commit(live.current), 350);
      },
    },
    {
      target: ref,
      enabled: !!photo,
      eventOptions: { passive: false },
      drag: { filterTaps: true },
    },
  );

  const pl = photo ? placePhoto(pf.rect, photo, cur) : null;
  const lowRes = pl && pl.ppi < LOW_PPI;

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (armed) placePhotoIn(target, armed);
    else select(target);
  };

  const setRefs = (el: HTMLDivElement | null) => {
    ref.current = el;
    drop.setNodeRef(el);
  };

  return (
    <div
      ref={setRefs}
      onClick={onClick}
      onDoubleClick={() => photo && updateFrame(target, { offsetX: 0, offsetY: 0, scale: 1 })}
      className={`group absolute overflow-hidden ${photo ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer'} ${
        photo ? '' : 'border border-dashed border-stone-300 bg-stone-100'
      } ${drop.isOver ? 'ring-4 ring-inset ring-orange-400/70' : ''} ${armed && !photo ? 'bg-orange-50' : ''}`}
      style={{ left: pf.rect.x * k, top: pf.rect.y * k, width: pf.rect.w * k, height: pf.rect.h * k }}
    >
      {photo ? (
        <PhotoImg rect={pf.rect} k={k} photo={photo} frame={cur} />
      ) : (
        <div className="pointer-events-none flex h-full w-full items-center justify-center text-stone-400">
          <span className="text-2xl leading-none">+</span>
        </div>
      )}

      {selected && <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-orange-500" />}

      {photo && (
        <button
          ref={drag.setNodeRef}
          data-handle
          {...drag.listeners}
          {...drag.attributes}
          onClick={(e) => e.stopPropagation()}
          title="Arrastra para mover la foto a otro recuadro"
          className={`absolute top-1 left-1 flex h-6 w-6 cursor-move items-center justify-center rounded-full bg-white/90 text-stone-700 shadow ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } touch-none`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            {[2, 6, 10].flatMap((x) => [3, 9].map((y) => <circle key={`${x}${y}`} cx={y} cy={x} r="1.2" />))}
          </svg>
        </button>
      )}

      {lowRes && (
        <div className="pointer-events-none absolute right-1 bottom-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white" title="Por debajo de 200 ppp efectivos">
          {Math.round(pl!.ppi)} ppp
        </div>
      )}
    </div>
  );
}
