import { useEffect, useRef, useState } from 'react';
import { db, deleteBooklet, saveBooklet, type BookletRow } from '../db/db';
import { ARCHIVE_EXT, ArchiveError, exportArchive, importArchive } from '../lib/archive';
import { download, fileSafe } from '../lib/exportPdf';
import { DEFAULT_FORMAT, FORMATS, getFormat, newBooklet, newZine } from '../model/factory';
import { sheetsFor } from '../model/imposition';
import { DEFAULT_ZINE, getZineMethod, ZINE_METHODS } from '../model/zine';
import { Btn, Seg } from './ui';
import { MethodCard } from './ZineViews';

type Kind = 'booklet' | 'zine';

export function Home({ onOpen }: { onOpen(id: string): void }) {
  const [rows, setRows] = useState<BookletRow[] | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Kind>('booklet');
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT.id);
  const [methodId, setMethodId] = useState(DEFAULT_ZINE.id);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => db.booklets.orderBy('updatedAt').reverse().toArray().then(setRows);
  useEffect(() => void refresh(), []);

  const create = async () => {
    const name = title.trim() || (kind === 'zine' ? 'Fanzine sin título' : 'Librito sin título');
    const b = kind === 'zine' ? newZine(name, methodId) : newBooklet(name, formatId);
    await saveBooklet(b);
    onOpen(b.id);
  };

  const importFile = async (file: File) => {
    setStatus({ text: `Abriendo ${file.name}…` });
    try {
      const id = await importArchive(file, (done, total) => setStatus({ text: `Importando fotos ${done}/${total}…` }));
      setStatus(null);
      onOpen(id);
    } catch (e) {
      setStatus({ text: e instanceof ArchiveError ? e.message : `No se pudo importar: ${e instanceof Error ? e.message : e}`, error: true });
    }
  };

  const exportRow = async (r: BookletRow) => {
    setStatus({ text: `Preparando ${r.title}…` });
    try {
      download(await exportArchive(r.data), fileSafe(r.title) + ARCHIVE_EXT);
      setStatus(null);
    } catch (e) {
      setStatus({ text: `No se pudo guardar el archivo: ${e instanceof Error ? e.message : e}`, error: true });
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl">Libritos</h1>
      <p className="mt-1 text-stone-600">Maqueta libritos cosidos y fanzines de una hoja, y descarga el PDF listo para imprimir, recortar y doblar.</p>

      <section className="mt-8 rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Nuevo</h2>
          <div className="w-64">
            <Seg<Kind>
              value={kind}
              onChange={setKind}
              options={[
                { value: 'booklet', label: 'Librito cosido' },
                { value: 'zine', label: 'Fanzine de una hoja' },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs text-stone-500">
            Título
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder={kind === 'zine' ? 'Zine nº 1' : 'Verano en la costa'}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-orange-500"
            />
          </label>
          {kind === 'booklet' && (
            <div className="flex flex-col gap-1 text-xs text-stone-500">
              Tamaño
              <div className="flex gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormatId(f.id)}
                    className={`rounded-md border px-3 py-1.5 text-left text-sm ${
                      formatId === f.id ? 'border-orange-600 bg-orange-50 text-stone-900' : 'border-stone-300 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <span className="font-medium">{f.name}</span>
                    <span className="block text-[11px] text-stone-500">
                      {f.w}×{f.h} mm · desde {f.paper}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <Btn variant="primary" onClick={create} className="py-2">
            Crear
          </Btn>
        </div>

        {kind === 'zine' && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-stone-500">
              Se imprime en un A4 con marcas de corte, se recorta a sangre y se dobla. Elige cómo se dobla; podrás cambiarlo después.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ZINE_METHODS.map((m) => (
                <MethodCard key={m.id} method={m} active={methodId === m.id} onClick={() => setMethodId(m.id)} />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Tus libritos y fanzines</h2>
          <Btn variant="outline" onClick={() => fileInput.current?.click()} title={`Abre un archivo ${ARCHIVE_EXT} guardado desde otro navegador o dispositivo`}>
            Abrir archivo {ARCHIVE_EXT}
          </Btn>
          <input
            ref={fileInput}
            type="file"
            accept={`${ARCHIVE_EXT},.zip,application/zip`}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) importFile(f);
            }}
          />
        </div>
        {status && <p className={`mb-3 rounded-md px-3 py-2 text-sm ${status.error ? 'bg-red-50 text-red-800' : 'bg-stone-100 text-stone-700'}`}>{status.text}</p>}
        {rows === null ? null : rows.length === 0 ? (
          <p className="text-sm text-stone-500">Todavía no hay ninguno. Se guardan en este navegador; para llevarlos a otro, usa «Guardar archivo» dentro del editor.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow-sm">
            {rows.map((r) => {
              const zine = r.data.kind === 'zine';
              const S = sheetsFor(r.data.spreads.length);
              const info = zine ? `Fanzine · ${getZineMethod(r.data.zine?.methodId).name}` : `${getFormat(r.data.formatId).name} · ${S} hoja${S > 1 ? 's' : ''}`;
              return (
                <li key={r.id} className="flex items-center gap-2 px-4 py-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(r.id)}>
                    <p className="truncate font-medium">{r.title || 'Sin título'}</p>
                    <p className="text-xs text-stone-500">
                      {info} · {new Date(r.updatedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </button>
                  {confirm === r.id ? (
                    <>
                      <Btn variant="danger" onClick={() => deleteBooklet(r.id).then(() => (setConfirm(null), refresh()))}>
                        Borrar definitivamente
                      </Btn>
                      <Btn onClick={() => setConfirm(null)}>Cancelar</Btn>
                    </>
                  ) : (
                    <>
                      <Btn variant="outline" onClick={() => onOpen(r.id)}>
                        Abrir
                      </Btn>
                      <Btn onClick={() => exportRow(r)} title={`Guardar como archivo ${ARCHIVE_EXT}`}>
                        ⤓
                      </Btn>
                      <Btn variant="danger" onClick={() => setConfirm(r.id)} title="Borrar">
                        ✕
                      </Btn>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
