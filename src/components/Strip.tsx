import { allSurfaceKeys } from '../model/geometry';
import { centerIndex, isFullValid, sheetsFor } from '../model/imposition';
import type { Photo } from '../model/types';
import { useEditor } from '../store/editor';
import { SurfaceView } from './SurfaceView';

/** Tira de miniaturas: cubierta y dobles en orden de lectura. */
export function Strip({ photos }: { photos: Map<string, Photo> }) {
  const b = useEditor((s) => s.booklet)!;
  const surface = useEditor((s) => s.sel.surface);
  const { select, addSpread } = useEditor.getState();
  const n = b.spreads.length;
  const center = centerIndex(n);
  const S = sheetsFor(n);
  const k = 56 / b.pageSize.h;

  return (
    <div className="border-t border-stone-200 bg-stone-50/80">
      <div className="flex items-center gap-3 px-3 pt-2 text-xs text-stone-600">
        <span>
          {S} hoja{S > 1 ? 's' : ''} · {4 * S} caras
        </span>
        {n % 2 === 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">Falta 1 doble para cerrar la hoja</span>}
      </div>
      <div className="flex items-end gap-3 overflow-x-auto px-3 pt-2 pb-3">
        {allSurfaceKeys(b).map((key) => {
          const active = surface === key;
          const bad = key !== 'cover' && !isFullValid(b.spreads, key);
          return (
            <button
              key={key === 'cover' ? 'cover' : b.spreads[key].id}
              onClick={() => select({ surface: key, page: key === 'cover' ? 'right' : 'left', slot: null })}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <div className={`rounded-sm p-0.5 ${active ? 'ring-2 ring-orange-500' : 'ring-1 ring-transparent hover:ring-stone-300'}`}>
                <SurfaceView booklet={b} surface={key} k={k} photos={photos} thumb />
              </div>
              <span className={`flex items-center gap-1 text-[11px] ${active ? 'font-semibold text-stone-900' : 'text-stone-500'}`}>
                {key === 'cover' ? 'Cubierta' : key + 1}
                {key === center && <span className="rounded bg-orange-700 px-1 text-[9px] font-medium text-white">central</span>}
                {bad && <span className="text-amber-600" title="Panorámica fuera de la central">⚠</span>}
              </span>
            </button>
          );
        })}
        <button
          onClick={addSpread}
          className="mb-5 flex shrink-0 flex-col items-center justify-center rounded-md border-2 border-dashed border-stone-300 px-3 text-xs text-stone-600 hover:border-orange-400 hover:text-orange-800"
          style={{ height: 60 }}
          title="Añadir una doble después de la seleccionada"
        >
          <span className="text-lg leading-none">+</span>
          Doble
        </button>
      </div>
    </div>
  );
}
