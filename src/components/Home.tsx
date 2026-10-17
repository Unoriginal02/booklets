import { useEffect, useState } from 'react';
import { db, deleteBooklet, saveBooklet, type BookletRow } from '../db/db';
import { DEFAULT_FORMAT, FORMATS, getFormat, newBooklet } from '../model/factory';
import { sheetsFor } from '../model/imposition';
import { Btn } from './ui';

export function Home({ onOpen }: { onOpen(id: string): void }) {
  const [rows, setRows] = useState<BookletRow[] | null>(null);
  const [title, setTitle] = useState('');
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT.id);
  const [confirm, setConfirm] = useState<string | null>(null);

  const refresh = () => db.booklets.orderBy('updatedAt').reverse().toArray().then(setRows);
  useEffect(() => void refresh(), []);

  const create = async () => {
    const b = newBooklet(title.trim() || 'Librito sin título', formatId);
    await saveBooklet(b);
    onOpen(b.id);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl">Libritos</h1>
      <p className="mt-1 text-stone-600">Maqueta libritos de fotos cosidos a caballete y descarga el PDF listo para imprimir, doblar y coser.</p>

      <section className="mt-8 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Nuevo librito</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs text-stone-500">
            Título
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="Verano en la costa"
              className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-orange-500"
            />
          </label>
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
          <Btn variant="primary" onClick={create} className="py-2">
            Crear
          </Btn>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Tus libritos</h2>
        {rows === null ? null : rows.length === 0 ? (
          <p className="text-sm text-stone-500">Todavía no hay ninguno. Se guardan en este navegador.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow-sm">
            {rows.map((r) => {
              const S = sheetsFor(r.data.spreads.length);
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(r.id)}>
                    <p className="truncate font-medium">{r.title || 'Sin título'}</p>
                    <p className="text-xs text-stone-500">
                      {getFormat(r.data.formatId).name} · {S} hoja{S > 1 ? 's' : ''} · {new Date(r.updatedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
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
