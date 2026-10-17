import { useEffect, useState } from 'react';
import { db } from './db/db';
import { loadPhotos } from './lib/photos';
import { useEditor } from './store/editor';
import { Editor } from './components/Editor';
import { ZineEditor } from './components/ZineEditor';
import { Home } from './components/Home';

export default function App() {
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(location.hash.slice(1)).get('b'));
  const loaded = useEditor((s) => s.booklet?.id);
  const kind = useEditor((s) => s.booklet?.kind);

  useEffect(() => {
    history.replaceState(null, '', openId ? `#b=${openId}` : location.pathname);
    if (!openId) return void useEditor.getState().close();
    let alive = true;
    (async () => {
      const row = await db.booklets.get(openId);
      if (!alive) return;
      if (!row) return setOpenId(null);
      const photos = await loadPhotos(openId);
      if (!alive) return;
      useEditor.getState().load(row.data, photos);
      useEditor.temporal.getState().clear();
    })();
    return () => {
      alive = false;
    };
  }, [openId]);

  if (openId && loaded === openId) return kind === 'zine' ? <ZineEditor onClose={() => setOpenId(null)} /> : <Editor onClose={() => setOpenId(null)} />;
  if (openId) return <div className="flex h-full items-center justify-center text-stone-500">Abriendo…</div>;
  return <Home onOpen={setOpenId} />;
}
