import { useState } from 'react';
import { fullAllowed, getSurface, LOW_PPI, MAX_SCALE, minScale, placePhoto, resolveSpacing, surfacePages } from '../model/geometry';
import { centerIndex, isForcedBlank, pageLabel } from '../model/imposition';
import { COVER_FULL_NAMES, PAGE_LAYOUTS, SPREAD_LAYOUTS } from '../model/layouts';
import { FORMATS, getFormat, paperName } from '../model/factory';
import type { FrameTarget, PageSide, Spacing } from '../model/types';
import { merging, useEditor, type SpacingScope } from '../store/editor';
import { LayoutPicker, RatioPicker } from './LayoutPicker';
import { Btn, NumField, Section, Seg } from './ui';

export function Inspector() {
  const b = useEditor((s) => s.booklet)!;
  const sel = useEditor((s) => s.sel);
  const showGuides = useEditor((s) => s.showGuides);
  const st = useEditor.getState();
  const key = sel.surface;
  const s = getSurface(b, key);
  if (!s) return null;
  const n = b.spreads.length;
  const isCover = key === 'cover';
  const center = centerIndex(n);
  const canFull = fullAllowed(b, key);
  const fullInvalid = !isCover && s.mode === 'full' && !canFull;
  const { w, h } = b.pageSize;
  const side: PageSide = sel.page === 'right' ? 'right' : 'left';

  const title = isCover ? 'Cubierta · exterior' : `Doble ${key + 1}${key === center ? ' · central' : ''}`;

  return (
    <div className="flex flex-col">
      <Section
        title={title}
        right={
          !isCover && (
            <div className="flex">
              <Btn title="Mover a la izquierda" disabled={key === 0} onClick={() => st.moveSpread(key, -1)}>
                ←
              </Btn>
              <Btn title="Mover a la derecha" disabled={key === n - 1} onClick={() => st.moveSpread(key, 1)}>
                →
              </Btn>
              <Btn title="Duplicar doble" onClick={() => st.duplicateSpread(key)}>
                ⧉
              </Btn>
              <Btn title="Borrar doble" variant="danger" disabled={n <= 1} onClick={() => st.deleteSpread(key)}>
                ✕
              </Btn>
            </div>
          )
        }
      >
        {fullInvalid && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
            <p className="mb-2">
              Esta panorámica ya no está en la doble central{n % 2 === 0 ? ' (falta 1 doble para cerrar la hoja)' : ''}. Solo la central se imprime en un papel continuo.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Btn variant="outline" onClick={() => st.splitFull(key)}>
                Partir en dos mitades
              </Btn>
              {center >= 0 && (
                <Btn variant="outline" onClick={() => st.moveToCenter(key)}>
                  Mover a la central
                </Btn>
              )}
            </div>
          </div>
        )}
        <Seg
          value={s.mode}
          onChange={(m) => st.setMode(key, m)}
          options={[
            { value: 'pages', label: isCover ? 'Por caras' : 'Dos páginas' },
            {
              value: 'full',
              label: isCover ? 'Envolvente' : 'Doble página',
              disabled: !canFull && s.mode !== 'full',
              title: canFull ? undefined : center >= 0 ? `Solo en la doble central (doble ${center + 1})` : 'Añade una doble para tener doble central',
            },
          ]}
        />
      </Section>

      <Section title="Composición">
        {s.mode === 'full' ? (
          <>
            <LayoutPicker
              layouts={isCover ? SPREAD_LAYOUTS.filter((l) => COVER_FULL_NAMES[l.id]) : SPREAD_LAYOUTS}
              names={isCover ? COVER_FULL_NAMES : undefined}
              value={s.full.layoutId}
              onChange={(id) => st.setLayout(key, 'full', id)}
              aspect={(2 * w) / h}
            />
            {!isCover && <RatioPicker scope="spread" value={s.full.layoutId} onChange={(id) => st.setLayout(key, 'full', id)} aspect={(2 * w) / h} />}
          </>
        ) : (
          <>
            <div className="mb-2">
              <Seg
                value={side}
                onChange={(v) => st.select({ page: v, slot: null })}
                options={(['left', 'right'] as const).map((v) => ({ value: v, label: pageLabel(n, key, v) }))}
              />
            </div>
            {isForcedBlank(b, key, side) ? (
              <p className="text-xs text-stone-500">Página en blanco porque la cubierta va en cartulina. Puedes cambiarlo en «Librito».</p>
            ) : (
              <>
                <LayoutPicker layouts={PAGE_LAYOUTS} value={s[side].layoutId} onChange={(id) => st.setLayout(key, side, id)} aspect={w / h} />
                <RatioPicker value={s[side].layoutId} onChange={(id) => st.setLayout(key, side, id)} aspect={w / h} />
              </>
            )}
          </>
        )}
      </Section>

      <FrameSection />
      <SpacingSection />

      <Section title="Librito">
        <label className="mb-2 flex flex-col gap-0.5 text-[11px] text-stone-500">
          Título
          <input
            value={b.title}
            onChange={(e) => merging('title', () => st.edit((d) => void (d.title = e.target.value)))}
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900 outline-none focus:border-orange-500"
          />
        </label>
        <label className="mb-1.5 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 accent-orange-700" checked={b.coverInsideBlank} onChange={(e) => st.edit((d) => void (d.coverInsideBlank = e.target.checked))} />
          <span>
            Interior de cubierta en blanco
            <span className="block text-xs text-stone-500">Para cubiertas en cartulina</span>
          </span>
        </label>
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-orange-700" checked={showGuides} onChange={st.toggleGuides} />
          Mostrar guías de margen
        </label>
        <div className="mb-1.5 flex items-center gap-2 text-[11px] text-stone-500">
          Formato
          <div className="flex-1">
            <Seg
              value={getFormat(b.formatId).id}
              onChange={(id) =>
                st.edit((d) => {
                  const f = getFormat(id);
                  d.formatId = f.id;
                  d.pageSize = { w: f.w, h: f.h };
                })
              }
              options={FORMATS.map((f) => ({ value: f.id, label: f.name }))}
            />
          </div>
        </div>
        <p className="text-xs text-stone-500">
          Página {w} × {h} mm · se imprime en {paperName(w, h)} apaisado. Las composiciones se recalculan solas; los márgenes se mantienen.
        </p>
      </Section>
    </div>
  );
}

function FrameSection() {
  const b = useEditor((s) => s.booklet)!;
  const sel = useEditor((s) => s.sel);
  const photos = useEditor((s) => s.photos);
  const st = useEditor.getState();
  if (sel.slot == null) return null;
  const pf = surfacePages(b, sel.surface)
    .find((p) => p.page === sel.page)
    ?.frames.find((f) => f.slot === sel.slot);
  if (!pf) return null;
  const t: FrameTarget = { surface: sel.surface, page: sel.page, slot: sel.slot };
  const f = pf.frame;
  const photo = photos.find((p) => p.id === f.photoId);

  if (!photo)
    return (
      <Section title="Recuadro">
        <p className="text-xs text-stone-500">Arrastra una foto aquí desde la bandeja, o tócala y luego toca el recuadro.</p>
      </Section>
    );

  const pl = placePhoto(pf.rect, photo, f);
  const low = pl.ppi < LOW_PPI;
  return (
    <Section title="Recuadro">
      <p className="mb-2 truncate text-xs text-stone-600" title={photo.name}>
        {photo.name} · <span className={low ? 'font-semibold text-red-700' : ''}>{Math.round(pl.ppi)} ppp</span>
        {low && <span className="block text-red-700">Por debajo de 200 ppp: se verá blanda al imprimir.</span>}
      </p>
      <div className="mb-2">
        <Seg
          value={f.fit}
          onChange={(fit) => st.updateFrame(t, { fit, scale: 1, offsetX: 0, offsetY: 0 })}
          options={[
            { value: 'cover', label: 'Rellenar' },
            { value: 'contain', label: 'Encajar entera' },
          ]}
        />
      </div>
      <label className="mb-2 flex items-center gap-2 text-xs text-stone-500">
        Zoom
        <input
          type="range"
          className="flex-1 accent-orange-700"
          min={minScale(f.fit)}
          max={MAX_SCALE}
          step={0.01}
          value={pl.scale}
          onChange={(e) => merging(`zoom:${sel.surface}:${sel.page}:${sel.slot}`, () => st.updateFrame(t, { scale: Number(e.target.value) }))}
        />
        <span className="w-9 text-right tabular-nums">{Math.round(pl.scale * 100)}%</span>
      </label>
      <div className="flex flex-wrap gap-1">
        <Btn variant="outline" onClick={() => st.updateFrame(t, { rotation: ((f.rotation + 90) % 360) as typeof f.rotation, offsetX: 0, offsetY: 0 })}>
          ↻ 90°
        </Btn>
        <Btn variant="outline" onClick={() => st.updateFrame(t, { flipX: !f.flipX })}>
          ⇋ Espejo
        </Btn>
        <Btn variant="outline" title="También con doble clic" onClick={() => st.updateFrame(t, { offsetX: 0, offsetY: 0, scale: 1 })}>
          Centrar
        </Btn>
        <Btn variant="danger" onClick={() => st.clearFrame(t)}>
          Quitar
        </Btn>
      </div>
      <p className="mt-2 text-[11px] text-stone-400">Arrastra para encuadrar · rueda o pellizco para escalar</p>
    </Section>
  );
}

const MARGIN_KEYS = ['top', 'bottom', 'outer', 'inner'] as const;

function SpacingSection() {
  const b = useEditor((s) => s.booklet)!;
  const sel = useEditor((s) => s.sel);
  const st = useEditor.getState();
  const [scope, setScope] = useState<SpacingScope>('global');
  const [locked, setLocked] = useState(false);
  const s = getSurface(b, sel.surface)!;
  const page = s[sel.page];

  const own: Partial<Spacing> | undefined = scope === 'global' ? b.spacing : scope === 'spread' ? s.spacing : page.spacing;
  const inherited = scope === 'global' ? b.spacing : scope === 'spread' ? b.spacing : resolveSpacing(b.spacing, s.spacing);
  const hasOverride = scope !== 'global' && !!own && Object.values(own).some((v) => typeof v === 'number');
  const isFull = sel.page === 'full';

  const set = (k: keyof Spacing, v: number | undefined) => {
    if (scope === 'global' && v === undefined) return;
    const patch: Partial<Spacing> = locked && k !== 'gap' ? Object.fromEntries(MARGIN_KEYS.map((m) => [m, v])) : { [k]: v };
    merging(`spacing:${scope}:${k}`, () => st.setSpacing(scope, patch));
  };

  const labels: Record<keyof Spacing, string> = {
    top: 'Superior',
    bottom: 'Inferior',
    outer: 'Exterior (corte)',
    inner: 'Interior (lomo)',
    gap: 'Separación',
  };

  return (
    <Section
      title="Márgenes y separación"
      right={
        <button
          onClick={() => setLocked(!locked)}
          title={locked ? 'Márgenes iguales: cambiar uno cambia los cuatro' : 'Igualar los cuatro márgenes'}
          className={`rounded px-1.5 py-0.5 text-xs ${locked ? 'bg-orange-100 text-orange-800' : 'text-stone-500 hover:bg-stone-200'}`}
        >
          {locked ? '🔒 iguales' : '🔓'}
        </button>
      }
    >
      <div className="mb-2">
        <Seg<SpacingScope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'global', label: 'Librito' },
            { value: 'spread', label: sel.surface === 'cover' ? 'Cubierta' : 'Esta doble' },
            { value: 'page', label: isFull ? 'Doble pág.' : 'Esta página' },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MARGIN_KEYS.map((k) => (
          <NumField
            key={k}
            label={labels[k]}
            value={own?.[k]}
            placeholder={inherited[k]}
            disabled={isFull && k === 'inner' && scope !== 'global'}
            onChange={(v) => set(k, v)}
          />
        ))}
        <NumField label={labels.gap} value={own?.gap} placeholder={inherited.gap} onChange={(v) => set('gap', v)} />
      </div>
      {scope !== 'global' && (
        <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
          <span>{hasOverride ? 'Sobrescribe el valor general' : 'Vacío = hereda el valor general'}</span>
          {hasOverride && (
            <Btn variant="outline" onClick={() => st.clearSpacing(scope)}>
              Volver al global
            </Btn>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] text-stone-400">Exterior e interior se reflejan solos en páginas pares e impares.</p>
    </Section>
  );
}
