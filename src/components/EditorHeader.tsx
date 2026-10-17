import { useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { ARCHIVE_EXT, exportArchive } from '../lib/archive';
import { download, fileSafe } from '../lib/exportPdf';
import { redo, undo, useEditor } from '../store/editor';
import { Btn } from './ui';

/** Cabecera común del editor de libritos y del de fanzines. */
export function EditorHeader({ saved, onClose, onExport, children }: { saved: boolean; onClose(): void; onExport(): void; children?: ReactNode }) {
  const b = useEditor((s) => s.booklet)!;
  const canUndo = useStore(useEditor.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useEditor.temporal, (s) => s.futureStates.length > 0);
  const [packing, setPacking] = useState(false);

  const saveFile = async () => {
    setPacking(true);
    try {
      download(await exportArchive(useEditor.getState().booklet!), fileSafe(b.title) + ARCHIVE_EXT);
    } finally {
      setPacking(false);
    }
  };

  return (
    <header className="flex items-center gap-2 border-b border-stone-200 bg-white/70 px-3 py-2 backdrop-blur">
      <Btn onClick={onClose} title="Volver a la lista">
        ← <span className="hidden sm:inline">Libritos</span>
      </Btn>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-serif text-lg leading-tight">
          {b.title || 'Sin título'}
          {b.kind === 'zine' && <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 align-middle font-sans text-[10px] font-medium tracking-wide text-stone-600 uppercase">Fanzine</span>}
        </h1>
        <p className="text-[11px] text-stone-500">{saved ? 'Guardado en este navegador' : 'Guardando…'}</p>
      </div>
      <Btn onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">
        ↶
      </Btn>
      <Btn onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Shift+Z)">
        ↷
      </Btn>
      <Btn variant="outline" onClick={saveFile} disabled={packing} title="Descarga un archivo .librito con la maqueta y las fotos, para abrirlo en otro navegador o dispositivo">
        {packing ? 'Preparando…' : 'Guardar archivo'}
      </Btn>
      {children}
      <Btn variant="primary" onClick={onExport}>
        Exportar PDF
      </Btn>
    </header>
  );
}
