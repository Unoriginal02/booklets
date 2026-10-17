import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useGesture } from '@use-gesture/react';
import { LOW_PPI, placePhoto } from '../model/geometry';
import { targetKey, type AnyTarget, type Frame, type Photo, type Rect } from '../model/types';
import type { Rot } from '../model/zine';
import { useEditor } from '../store/editor';
import { PhotoImg } from './PhotoImg';

type Framing = Pick<Frame, 'offsetX' | 'offsetY' | 'scale'>;

interface Props {
  target: AnyTarget;
  /** dónde va el recuadro en la superficie, en mm */
  rect: Rect;
  /** la página puede ir girada en la hoja (fanzines): la foto se encuadra con la página del derecho */
  rotation?: Rot;
  k: number;
  frame: Frame;
  photo?: Photo;
  selected: boolean;
  /** se dibuja encima de la foto, girado con la página */
  overlay?: ReactNode;
}

/** Pasa un movimiento de pantalla a los ejes de la página girada. */
function unrotate(mx: number, my: number, rot: Rot): [number, number] {
  if (rot === 90) return [my, -mx];
  if (rot === 180) return [-mx, -my];
  if (rot === 270) return [-my, mx];
  return [mx, my];
}

export function FrameView({ target, rect, rotation = 0, k, frame, photo, selected, overlay }: Props) {
  const tid = targetKey(target);
  const armed = useEditor((s) => s.armed);
  const { selectTarget, updateFrame, placePhotoIn } = useEditor.getState();
  // tamaño del recuadro con la página del derecho
  const size = rotation % 180 ? { w: rect.h, h: rect.w } : { w: rect.w, h: rect.h };

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
    const pl = placePhoto(size, photo, { ...frame, ...f });
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
        const [dx, dy] = unrotate(mx, my, rotation);
        const next = clamp({ ...base, offsetX: base.offsetX + dx / (size.w * k), offsetY: base.offsetY + dy / (size.h * k) });
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

  const pl = photo ? placePhoto(size, photo, cur) : null;
  const lowRes = pl && pl.ppi < LOW_PPI;

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (armed) placePhotoIn(target, armed);
    else selectTarget(target);
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
      style={{ left: rect.x * k, top: rect.y * k, width: rect.w * k, height: rect.h * k }}
    >
      {/* la página, del derecho, girada dentro del recuadro */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2"
        style={{ width: size.w * k, height: size.h * k, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
      >
        {photo ? (
          <PhotoImg rect={size} k={k} photo={photo} frame={cur} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-400">
            <span className="text-2xl leading-none">+</span>
          </div>
        )}
        {overlay}
      </div>

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
