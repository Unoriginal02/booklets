import { useMemo, useState } from 'react';
import { download, fileSafe, runPdf } from '../lib/exportPdf';
import { getFormat, paperName } from '../model/factory';
import { allPlacedFrames, LOW_PPI, placePhoto } from '../model/geometry';
import { isFullValid, pageLabel, sheetsFor } from '../model/imposition';
import { paddedBooklet, useEditor } from '../store/editor';
import { Btn } from './ui';

export function ExportDialog({ onClose }: { onClose(): void }) {
  const original = useEditor((s) => s.booklet)!;
  const photoList = useEditor((s) => s.photos);
  const [marks, setMarks] = useState(true);
  const [bleed, setBleed] = useState(false);
  const [coverSeparateOpt, setCoverSeparate] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fmt = getFormat(original.formatId);
  const paper = marks ? fmt.marksPaper : undefined;
  const b = useMemo(() => ({ ...paddedBooklet(original), bleed: marks && bleed ? 3 : 0 }), [original, marks, bleed]);
  const S = sheetsFor(b.spreads.length);
  const { w, h } = b.pageSize;
  const sheetPaper = paperName(w, h);
  // con una sola hoja no queda interior que separar
  const coverSeparate = coverSeparateOpt && S > 1;

  const checks = useMemo(() => {
    const photos = new Map(photoList.map((p) => [p.id, p]));
    const n = b.spreads.length;
    const badFull = b.spreads.map((_, i) => i).filter((i) => !isFullValid(b.spreads, i));
    const low: string[] = [];
    let empty = 0;
    for (const pf of allPlacedFrames(b)) {
      const p = pf.frame.photoId ? photos.get(pf.frame.photoId) : undefined;
      if (!p) {
        empty++;
        continue;
      }
      const ppi = placePhoto(pf.rect, p, pf.frame).ppi;
      if (ppi < LOW_PPI) {
        const where = pf.page === 'full' ? (pf.surface === 'cover' ? 'Cubierta' : `Doble ${(pf.surface as number) + 1}`) : pageLabel(n, pf.surface, pf.page);
        low.push(`${where}: ${p.name} (${Math.round(ppi)} ppp)`);
      }
    }
    return { badFull, low, empty };
  }, [b, photoList]);

  const busy = progress != null;
  const blocked = checks.badFull.length > 0;
  const base = fileSafe(original.title);

  const exportBooklet = async () => {
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      const res = await runPdf({ kind: 'booklet', booklet: b, photos: photoList, coverSeparate, paper }, (done, total) => setProgress({ done, total }));
      download(res.main, `${base}${coverSeparate ? '-interior' : ''}.pdf`);
      if (res.cover) setTimeout(() => download(res.cover!, `${base}-cubierta.pdf`), 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  const exportTest = async () => {
    setError(null);
    try {
      const res = await runPdf({ kind: 'test', w, h, paper });
      download(res.main, 'hoja-de-prueba.pdf');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const printPaper = paper ? fmt.marksPaper.name : sheetPaper;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4" onClick={() => !busy && onClose()}>
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-stone-200 px-5 py-4">
          <h2 className="font-serif text-xl">Exportar PDF</h2>
          <p className="text-sm text-stone-600">
            {S} hoja{S > 1 ? 's' : ''} · {2 * S} páginas de PDF · hoja {2 * w} × {h} mm ({sheetPaper})
            {paper && ` centrada en ${fmt.marksPaper.name}`}
          </p>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          {(blocked || checks.low.length > 0 || original.spreads.length % 2 === 0 || checks.empty > 0) && (
            <ul className="space-y-1.5">
              {checks.badFull.map((i) => (
                <li key={i} className="rounded-md bg-red-50 px-3 py-2 text-red-800">
                  La doble {i + 1} tiene una composición de doble página, pero no es la central. Pártela o muévela antes de exportar.
                </li>
              ))}
              {original.spreads.length % 2 === 0 && (
                <li className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">Falta 1 doble para cerrar la hoja: se añadirá una en blanco antes de la última.</li>
              )}
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
                  {checks.empty} recuadro{checks.empty > 1 ? 's' : ''} sin foto: saldrá{checks.empty > 1 ? 'n' : ''} en blanco.
                </li>
              )}
            </ul>
          )}

          <fieldset className="space-y-2">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 accent-orange-700" checked={marks} onChange={(e) => setMarks(e.target.checked)} />
              <span>
                Marcas de corte y de pliegue
                <span className="block text-xs text-stone-500">
                  La hoja {sheetPaper} se centra en un {fmt.marksPaper.name}; se recorta por las marcas.
                </span>
              </span>
            </label>
            <label className={`flex items-start gap-2 pl-6 ${marks ? '' : 'opacity-40'}`}>
              <input type="checkbox" className="mt-1 accent-orange-700" disabled={!marks} checked={bleed} onChange={(e) => setBleed(e.target.checked)} />
              <span>
                Sangrado de 3 mm
                <span className="block text-xs text-stone-500">Las fotos a sangre se extienden 3 mm más allá del corte, para que no quede filo blanco.</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 accent-orange-700" disabled={S < 2} checked={coverSeparate} onChange={(e) => setCoverSeparate(e.target.checked)} />
              <span>
                Cubierta aparte
                <span className="block text-xs text-stone-500">Un PDF solo con la cubierta (páginas 1–2), para imprimirla en cartulina.</span>
              </span>
            </label>
          </fieldset>

          <div className="rounded-md bg-stone-50 p-3 text-xs text-stone-700">
            <p className="mb-1 font-semibold">Cómo imprimirlo</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Opcional: imprime la hoja de prueba para comprobar el volteo de tu impresora.</li>
              <li>
                Papel {printPaper}, tamaño real (100 %, sin «ajustar a página»), <b>doble cara volteando por el borde corto</b>.
              </li>
              {coverSeparate && <li>Imprime el PDF de la cubierta en cartulina con los mismos ajustes.</li>}
              {paper && <li>Recorta cada hoja por las marcas de las esquinas{bleed ? ' (el sangrado queda fuera)' : ''}.</li>}
              <li>Pon las hojas boca abajo en el orden del PDF: la cubierta primero, debajo de todo. La última hoja queda encima mostrando la doble central.</li>
              <li>Dobla el montón por la mitad{paper ? ' siguiendo las marcas de pliegue' : ''}, cuadra los bordes y cose o grapa por el pliegue.</li>
            </ol>
          </div>

          {busy && (
            <div>
              <div className="h-2 overflow-hidden rounded bg-stone-200">
                <div className="h-full bg-orange-700 transition-all" style={{ width: `${progress.total ? (100 * progress.done) / progress.total : 5}%` }} />
              </div>
              <p className="mt-1 text-xs text-stone-500">
                Preparando fotos {progress.done}/{progress.total}…
              </p>
            </div>
          )}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-red-800">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 px-5 py-3">
          <Btn onClick={exportTest} disabled={busy} className="mr-auto">
            Hoja de prueba
          </Btn>
          <Btn variant="outline" onClick={onClose} disabled={busy}>
            Cerrar
          </Btn>
          <Btn variant="primary" onClick={exportBooklet} disabled={busy || blocked}>
            {busy ? 'Generando…' : 'Descargar PDF'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
