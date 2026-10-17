import { useMemo, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { LOW_PPI, placePhoto } from '../model/geometry';
import { frameUses } from '../model/uses';
import { importPhotos, photoUrl, removePhoto } from '../lib/photos';
import type { Photo } from '../model/types';
import { useEditor } from '../store/editor';
import { Btn } from './ui';

export function Tray() {
  const b = useEditor((s) => s.booklet)!;
  const photos = useEditor((s) => s.photos);
  const armed = useEditor((s) => s.armed);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState(false);

  // usos de cada foto y la peor resolución con la que aparece
  const usage = useMemo(() => {
    const byId = new Map(photos.map((p) => [p.id, p]));
    const m = new Map<string, { count: number; minPpi: number }>();
    for (const use of frameUses(b)) {
      const p = use.frame.photoId ? byId.get(use.frame.photoId) : undefined;
      if (!p) continue;
      const u = m.get(p.id) ?? { count: 0, minPpi: Infinity };
      u.count++;
      u.minPpi = Math.min(u.minPpi, placePhoto(use.size, p, use.frame).ppi);
      m.set(p.id, u);
    }
    return m;
  }, [b, photos]);

  const add = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!imgs.length) return;
    setError(null);
    setBusy(`Importando ${imgs.length} foto${imgs.length > 1 ? 's' : ''}…`);
    const { photos: added, failed } = await importPhotos(b.id, imgs);
    useEditor.getState().addPhotos(added);
    setBusy(null);
    if (failed.length) setError(`No se pudieron abrir: ${failed.join(', ')}`);
  };

  const remove = async (p: Photo) => {
    await removePhoto(p.id);
    useEditor.getState().dropPhotoMeta(p.id);
  };

  return (
    <div
      className={`flex h-full flex-col ${hover ? 'bg-orange-50' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setHover(true);
        }
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        add([...e.dataTransfer.files]);
      }}
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2">
        <h3 className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase">Fotos · {photos.length}</h3>
        <Btn variant="outline" onClick={() => input.current?.click()}>
          + Añadir
        </Btn>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            add([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>
      {busy && <p className="px-3 py-2 text-xs text-stone-600">{busy}</p>}
      {error && <p className="px-3 py-2 text-xs text-red-700">{error}</p>}
      {armed && <p className="bg-orange-100 px-3 py-1.5 text-xs text-orange-900">Toca un recuadro para colocar la foto</p>}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-2">
        {photos.length === 0 ? (
          <button
            onClick={() => input.current?.click()}
            className="flex h-32 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 text-sm text-stone-500 hover:border-orange-400"
          >
            Arrastra fotos aquí
            <span className="text-xs">o pulsa para elegir</span>
          </button>
        ) : (
          <div className="flex gap-2 md:grid md:grid-cols-2">
            {photos.map((p) => (
              <TrayItem key={p.id} photo={p} usage={usage.get(p.id)} armed={armed === p.id} onRemove={() => remove(p)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TrayItem({ photo, usage, armed, onRemove }: { photo: Photo; usage?: { count: number; minPpi: number }; armed: boolean; onRemove(): void }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `photo:${photo.id}`, data: { kind: 'photo', photoId: photo.id } });
  const arm = useEditor((s) => s.arm);
  const low = usage && usage.minPpi < LOW_PPI;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => arm(armed ? null : photo.id)}
      title={`${photo.name} · ${photo.w} × ${photo.h} px`}
      className={`group relative aspect-square w-20 shrink-0 cursor-grab touch-manipulation overflow-hidden rounded-md bg-stone-200 md:w-auto ${
        armed ? 'ring-2 ring-orange-500' : ''
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <img src={photoUrl(photo.id, 'thumb')} alt={photo.name} draggable={false} className="h-full w-full object-cover" />
      {usage && (
        <span className="absolute bottom-1 left-1 rounded bg-stone-900/75 px-1 text-[10px] text-white" title="Veces usada">
          ✓{usage.count > 1 ? ` ${usage.count}` : ''}
        </span>
      )}
      {low && (
        <span className="absolute right-1 bottom-1 rounded bg-red-600 px-1 text-[10px] text-white" title="Baja resolución en algún recuadro">
          {Math.round(usage!.minPpi)} ppp
        </span>
      )}
      {!usage && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Quitar de la bandeja"
          className="absolute top-1 right-1 hidden h-5 w-5 items-center justify-center rounded-full bg-white/90 text-xs text-stone-700 shadow group-hover:flex"
        >
          ✕
        </button>
      )}
    </div>
  );
}
