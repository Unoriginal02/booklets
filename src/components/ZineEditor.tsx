import { useEffect, useMemo, useRef, useState } from 'react';
import { download, fileSafe, runPdf } from '../lib/exportPdf';
import { LOW_PPI, placePhoto } from '../model/geometry';
import { frameUses } from '../model/uses';
import { duplexEdge, getZineMethod, paperFor, pageSizeOf, ZINE_METHODS, zineFrames } from '../model/zine';
import type { Photo } from '../model/types';
import { merging, useEditor } from '../store/editor';
import { EditorHeader } from './EditorHeader';
import { FrameControls } from './Inspector';
import { PhotoDnd, TrayDrop, useEditorChrome } from './PhotoDnd';
import { Tray } from './Tray';
import { Btn, NumField, Section, Seg } from './ui';
import { FoldedPreview, MethodCard, ZineSheet } from './ZineViews';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

export function ZineEditor({ onClose }: { onClose(): void }) {
  const photoList = useEditor((s) => s.photos);
  const photos = useMemo(() => new Map(photoList.map((p) => [p.id, p])), [photoList]);
  const saved = useEditorChrome();
  const [exporting, setExporting] = useState(false);

  return (
    <PhotoDnd>
      <div className="flex h-full flex-col">
        <EditorHeader saved={saved} onClose={onClose} onExport={() => setExporting(true)} />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <TrayDrop>
            <Tray />
          </TrayDrop>
          <main className="flex min-h-[60vh] min-w-0 flex-1 flex-col md:min-h-0">
            <ZineCanvas photos={photos} />
          </main>
          <aside className="order-3 overflow-y-auto border-stone-200 bg-white/60 md:w-80 md:border-l">
            <ZineInspector />
          </aside>
        </div>
      </div>
      {exporting && <ZineExportDialog onClose={() => setExporting(false)} />}
    </PhotoDnd>
  );
}

function ZineCanvas({ photos }: { photos: Map<string, Photo> }) {
  const b = useEditor((s) => s.booklet)!;
  const method = getZineMethod(b.zine?.methodId);
  const [view, setView] = useState<'sheet' | 'folded'>('sheet');
  const [guides, setGuides] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });

  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = method.sides;
  const { w, h } = method.trim;
  const pad = 48;
  const label = 34;
  // una cara debajo de otra o una al lado de otra, lo que deje la hoja más grande
  const kCol = Math.min((size.w - pad) / w, (size.h - pad - n * label) / (n * h));
  const kRow = Math.min((size.w - pad - (n - 1) * 24) / (n * w), (size.h - pad - label) / h);
  const row = n === 2 && kRow > kCol;
  const k = Math.max(0.4, row ? kRow : kCol);

  const sideLabel = (side: 0 | 1) =>
    n === 1 ? 'La hoja · se imprime a una cara' : side === 0 ? 'Cara A · página 1 del PDF' : `Cara B · el reverso, volteando por el borde ${duplexEdge(method)} (página 2 del PDF)`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-4 py-2">
        <div className="w-80 max-w-full">
          <Seg<'sheet' | 'folded'>
            value={view}
            onChange={setView}
            options={[
              { value: 'sheet', label: 'Hoja para imprimir' },
              { value: 'folded', label: 'Doblado, en orden de lectura' },
            ]}
          />
        </div>
        {view === 'sheet' && (
          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" className="accent-orange-700" checked={guides} onChange={(e) => setGuides(e.target.checked)} />
            Dobleces <span className="text-sky-600">- -</span> y cortes <span className="text-red-600">—</span>
          </label>
        )}
        <span className="text-xs text-stone-500">
          {method.pages} páginas · {method.sides === 1 ? 'una cara' : 'doble cara'} · A4 {method.orientation === 'landscape' ? 'apaisado' : 'vertical'}
        </span>
      </div>
      <div ref={ref} className="relative min-h-0 flex-1 overflow-auto" onClick={(e) => e.target === e.currentTarget && useEditor.getState().arm(null)}>
        {view === 'sheet' ? (
          <div className={`flex min-h-full items-center justify-center gap-6 p-5 ${row ? 'flex-row' : 'flex-col'}`}>
            {(n === 2 ? [0, 1] : [0]).map((side) => (
              <div key={side} className="flex flex-col gap-2">
                <p className="text-xs font-medium text-stone-600">{sideLabel(side as 0 | 1)}</p>
                <ZineSheet booklet={b} method={method} side={side as 0 | 1} k={k} photos={photos} interactive guides={guides} />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6">
            <p className="mb-4 text-center text-xs text-stone-500">Así se lee una vez doblado: cada página del derecho y en su orden.</p>
            <FoldedPreview booklet={b} photos={photos} height={Math.min(260, Math.max(120, size.h / 3))} />
          </div>
        )}
      </div>
    </div>
  );
}

function ZineInspector() {
  const b = useEditor((s) => s.booklet)!;
  const zsel = useEditor((s) => s.zsel);
  const st = useEditor.getState();
  const method = getZineMethod(b.zine?.methodId);
  const [picking, setPicking] = useState(false);
  const selected = zsel != null ? zineFrames(b).find((z) => z.panel.num === zsel) : undefined;
  const page = pageSizeOf(method.panels[0]);
  const hidden = Object.entries(b.zine?.frames ?? {}).filter(([num, f]) => f.photoId && Number(num) > method.pages).length;

  return (
    <div className="flex flex-col">
      <Section
        title="Plegado"
        right={
          <Btn variant="outline" onClick={() => setPicking(!picking)}>
            {picking ? 'Cerrar' : 'Cambiar'}
          </Btn>
        }
      >
        {picking ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-stone-500">Cada foto se queda en su número de página al cambiar de plegado.</p>
            {ZINE_METHODS.map((m) => (
              <MethodCard
                key={m.id}
                method={m}
                active={m.id === method.id}
                onClick={() => {
                  st.edit((d) => void (d.zine!.methodId = m.id));
                  useEditor.setState({ zsel: null });
                  setPicking(false);
                }}
              />
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold">{method.name}</p>
            <p className="mt-0.5 text-xs text-stone-600">{method.summary}</p>
            <p className="mt-1.5 text-xs text-stone-500">
              {method.pages} páginas de unos {fmt(page.w)} × {fmt(page.h)} mm · {method.sides === 1 ? 'una cara' : 'doble cara'}
            </p>
            {hidden > 0 && (
              <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                {hidden} foto{hidden > 1 ? 's' : ''} en páginas que este plegado no tiene. Siguen guardadas y vuelven si eliges un plegado con más páginas.
              </p>
            )}
          </>
        )}
      </Section>

      {selected ? (
        <>
          <div className="border-b border-stone-200 bg-orange-50/60 px-4 py-2 text-xs text-stone-700">
            <b className="text-base tabular-nums">{selected.panel.num}</b> · {selected.panel.name}
            {selected.panel.rot === 180 && <span className="block text-stone-500">Va cabeza abajo en la hoja: al doblar queda del derecho.</span>}
          </div>
          <FrameControls target={selected.target} size={selected.size} frame={selected.frame} />
        </>
      ) : (
        <Section title="Página">
          <p className="text-xs text-stone-500">Toca un panel para ver su página. Arrastra fotos desde la bandeja: el número grande es la página que será una vez doblado.</p>
        </Section>
      )}

      <Section title="Cómo doblarlo">
        <ol className="list-decimal space-y-1.5 pl-4 text-xs text-stone-700">
          {method.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Section>

      <Section title="Margen">
        <NumField
          label="Margen dentro de cada página"
          value={b.zine?.margin ?? 0}
          onChange={(v) => merging('zine-margin', () => st.edit((d) => void (d.zine!.margin = v ?? 0)))}
        />
        <p className="mt-1.5 text-[11px] text-stone-400">0 = a sangre: las fotos llegan al borde y se pasan 3 mm por fuera del corte, para que no quede filo blanco.</p>
      </Section>

      <Section title="Fanzine">
        <label className="flex flex-col gap-0.5 text-[11px] text-stone-500">
          Título
          <input
            value={b.title}
            onChange={(e) => merging('title', () => st.edit((d) => void (d.title = e.target.value)))}
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900 outline-none focus:border-orange-500"
          />
        </label>
      </Section>
    </div>
  );
}

function ZineExportDialog({ onClose }: { onClose(): void }) {
  const b = useEditor((s) => s.booklet)!;
  const photoList = useEditor((s) => s.photos);
  const method = getZineMethod(b.zine?.methodId);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paper = paperFor(method);

  const checks = useMemo(() => {
    const photos = new Map(photoList.map((p) => [p.id, p]));
    const low: string[] = [];
    let empty = 0;
    for (const u of frameUses(b)) {
      const p = u.frame.photoId ? photos.get(u.frame.photoId) : undefined;
      if (!p) {
        empty++;
        continue;
      }
      const ppi = placePhoto(u.size, p, u.frame).ppi;
      if (ppi < LOW_PPI) low.push(`${u.label}: ${p.name} (${Math.round(ppi)} ppp)`);
    }
    return { low, empty };
  }, [b, photoList]);

  const base = fileSafe(b.title);
  const run = async (kind: 'zine' | 'zineGuide') => {
    setError(null);
    setBusy({ done: 0, total: 0 });
    try {
      const res =
        kind === 'zine'
          ? await runPdf({ kind: 'zine', booklet: b, photos: photoList }, (done, total) => setBusy({ done, total }))
          : await runPdf({ kind: 'zineGuide', methodId: method.id });
      download(res.main, kind === 'zine' ? `${base}.pdf` : `maqueta-${method.id}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4" onClick={() => !busy && onClose()}>
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-stone-200 px-5 py-4">
          <h2 className="font-serif text-xl">Exportar PDF</h2>
          <p className="text-sm text-stone-600">
            {method.name} · {method.sides === 1 ? '1 página' : '2 páginas'} de PDF en A4 {method.orientation === 'landscape' ? 'apaisado' : 'vertical'}, con marcas de corte y sangrado de 3 mm
          </p>
        </div>
        <div className="space-y-4 px-5 py-4 text-sm">
          {(checks.low.length > 0 || checks.empty > 0) && (
            <ul className="space-y-1.5">
              {checks.low.length > 0 && (
                <li className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
                  Fotos por debajo de 200 ppp:
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {checks.low.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </li>
              )}
              {checks.empty > 0 && (
                <li className="rounded-md bg-stone-100 px-3 py-2 text-stone-700">
                  {checks.empty} página{checks.empty > 1 ? 's' : ''} sin foto: saldrá{checks.empty > 1 ? 'n' : ''} en blanco.
                </li>
              )}
            </ul>
          )}
          <div className="rounded-md bg-stone-50 p-3 text-xs text-stone-700">
            <p className="mb-1 font-semibold">Antes de gastar fotos</p>
            <p>
              La <b>maqueta de prueba</b> es la misma hoja con los números de página y los dobleces, sin fotos. Imprímela, dóblala siguiendo los pasos y comprueba que cada número cae
              donde esperas.
            </p>
          </div>
          <div className="rounded-md bg-stone-50 p-3 text-xs text-stone-700">
            <p className="mb-1 font-semibold">Cómo imprimirlo</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Papel A4 ({paper.w} × {paper.h} mm), tamaño real (100 %, sin «ajustar a página»)
                {method.sides === 2 ? (
                  <>
                    , <b>doble cara volteando por el borde {duplexEdge(method)}</b>
                  </>
                ) : (
                  ', a una cara'
                )}
                .
              </li>
              {method.steps.slice(1).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          {busy && (
            <div>
              <div className="h-2 overflow-hidden rounded bg-stone-200">
                <div className="h-full bg-orange-700 transition-all" style={{ width: `${busy.total ? (100 * busy.done) / busy.total : 5}%` }} />
              </div>
              <p className="mt-1 text-xs text-stone-500">
                Preparando fotos {busy.done}/{busy.total}…
              </p>
            </div>
          )}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-red-800">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 px-5 py-3">
          <Btn onClick={() => run('zineGuide')} disabled={!!busy} className="mr-auto">
            Maqueta de prueba
          </Btn>
          <Btn variant="outline" onClick={onClose} disabled={!!busy}>
            Cerrar
          </Btn>
          <Btn variant="primary" onClick={() => run('zine')} disabled={!!busy}>
            {busy ? 'Generando…' : 'Descargar PDF'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
