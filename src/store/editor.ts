import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { blankSpread, cloneSpread, newPage, newSpread } from '../model/factory';
import { fullAllowed, layoutBox, layoutToRects, newFrame, placePhoto, resolveSpacing } from '../model/geometry';
import { centerIndex, padSpreads } from '../model/imposition';
import { getLayout } from '../model/layouts';
import type { Booklet, Frame, FrameTarget, Page, PageKey, Photo, Spacing, Spread, SurfaceKey } from '../model/types';

let mergeKey: string | null = null;

/** Ejecuta un cambio que se funde en el historial con los anteriores de la misma clave. */
export function merging(key: string, fn: () => void) {
  mergeKey = key;
  try {
    fn();
  } finally {
    mergeKey = null;
  }
}

export type SpacingScope = 'global' | 'spread' | 'page';

export interface Selection {
  surface: SurfaceKey;
  page: PageKey;
  slot: number | null;
}

interface EditorState {
  booklet: Booklet | null;
  photos: Photo[];
  sel: Selection;
  /** foto elegida en la bandeja para colocar con un toque (móvil) */
  armed: string | null;
  showGuides: boolean;

  load(b: Booklet, photos: Photo[]): void;
  close(): void;
  edit(fn: (b: Booklet) => void): void;
  select(sel: Partial<Selection>): void;
  arm(id: string | null): void;
  toggleGuides(): void;
  addPhotos(p: Photo[]): void;
  dropPhotoMeta(id: string): void;

  addSpread(): void;
  duplicateSpread(i: number): void;
  deleteSpread(i: number): void;
  moveSpread(i: number, dir: -1 | 1): void;
  moveToCenter(i: number): void;
  splitFull(i: number): void;

  setMode(key: SurfaceKey, mode: Spread['mode']): void;
  setLayout(key: SurfaceKey, page: PageKey, layoutId: string): void;
  placePhotoIn(t: FrameTarget, photoId: string): void;
  swapFrames(a: FrameTarget, b: FrameTarget): void;
  updateFrame(t: FrameTarget, patch: Partial<Frame>): void;
  clearFrame(t: FrameTarget): void;

  setSpacing(scope: SpacingScope, patch: Partial<Spacing>): void;
  clearSpacing(scope: SpacingScope): void;
}

function surf(b: Booklet, key: SurfaceKey): Spread {
  return key === 'cover' ? b.cover : b.spreads[key];
}

function frameAt(b: Booklet, t: FrameTarget): Frame | undefined {
  const page = surf(b, t.surface)?.[t.page];
  if (!page) return undefined;
  while (page.frames.length <= t.slot) page.frames.push(newFrame(page.frames.length));
  return page.frames[t.slot];
}

const resetFraming = (f: Frame) => {
  f.offsetX = 0;
  f.offsetY = 0;
  f.scale = 1;
};

export const useEditor = create<EditorState>()(
  temporal(
    immer((set) => ({
      booklet: null,
      photos: [],
      sel: { surface: 0, page: 'left', slot: null },
      armed: null,
      showGuides: true,

      load: (b, photos) => set({ booklet: b, photos, sel: { surface: 'cover', page: 'right', slot: null }, armed: null }),
      close: () => set({ booklet: null, photos: [] }),
      edit: (fn) =>
        set((s) => {
          if (s.booklet) fn(s.booklet);
        }),
      select: (sel) => set((s) => void Object.assign(s.sel, sel)),
      arm: (id) => set({ armed: id }),
      toggleGuides: () => set((s) => void (s.showGuides = !s.showGuides)),
      addPhotos: (p) => set((s) => void s.photos.push(...p)),
      dropPhotoMeta: (id) => set((s) => void (s.photos = s.photos.filter((p) => p.id !== id))),

      addSpread: () =>
        set((s) => {
          const b = s.booklet!;
          const cur = typeof s.sel.surface === 'number' ? s.sel.surface : b.spreads.length - 1;
          const at = Math.min(cur + 1, b.spreads.length);
          b.spreads.splice(at, 0, newSpread());
          s.sel = { surface: at, page: 'left', slot: null };
        }),
      duplicateSpread: (i) =>
        set((s) => {
          const b = s.booklet!;
          b.spreads.splice(i + 1, 0, cloneSpread(b.spreads[i]));
          s.sel = { surface: i + 1, page: b.spreads[i].mode === 'full' ? 'full' : 'left', slot: null };
        }),
      deleteSpread: (i) =>
        set((s) => {
          const b = s.booklet!;
          if (b.spreads.length <= 1) return;
          b.spreads.splice(i, 1);
          s.sel = { surface: Math.min(i, b.spreads.length - 1), page: 'left', slot: null };
        }),
      moveSpread: (i, dir) =>
        set((s) => {
          const b = s.booklet!;
          const j = i + dir;
          if (j < 0 || j >= b.spreads.length) return;
          [b.spreads[i], b.spreads[j]] = [b.spreads[j], b.spreads[i]];
          s.sel.surface = j;
        }),
      moveToCenter: (i) =>
        set((s) => {
          const b = s.booklet!;
          const c = centerIndex(b.spreads.length);
          if (c < 0 || c === i) return;
          [b.spreads[i], b.spreads[c]] = [b.spreads[c], b.spreads[i]];
          s.sel = { surface: c, page: 'full', slot: null };
        }),
      splitFull: (i) =>
        set((s) => {
          // parte la panorámica en dos mitades que, juntas, se ven igual
          const b = s.booklet!;
          const sp = b.spreads[i];
          const src = sp.full.frames.find((f) => f.photoId);
          sp.mode = 'pages';
          s.sel = { surface: i, page: 'left', slot: null };
          if (!src) return;
          const photo = s.photos.find((p) => p.id === src.photoId);
          sp.left = newPage('P1-full');
          sp.right = newPage('P1-full');
          if (!photo) return;
          const { w, h } = b.pageSize;
          const spc = resolveSpacing(b.spacing, sp.spacing, sp.full.spacing);
          const fullLayout = getLayout(sp.full.layoutId);
          // el recuadro real: en las proporciones centradas es menor que la caja de márgenes
          const fullBox = layoutToRects(fullLayout, layoutBox(fullLayout, 'full', w, h, spc, b.bleed), spc.gap)[src.slot];
          const pano = placePhoto(fullBox, photo, src);
          const halfBox = layoutBox(getLayout('P1-full'), 'left', w, h, spc, b.bleed);
          const halfBase = placePhoto(halfBox, photo, { ...src, offsetX: 0, offsetY: 0, scale: 1 });
          const scale = pano.rw / halfBase.rw;
          const cx = fullBox.x + pano.cx; // centro de la foto en coordenadas de la doble
          const cy = fullBox.y + pano.cy;
          for (const side of ['left', 'right'] as const) {
            const box = layoutBox(getLayout('P1-full'), side, w, h, spc, b.bleed);
            sp[side].frames[0] = {
              ...src,
              slot: 0,
              scale,
              offsetX: (cx - box.x - box.w / 2) / box.w,
              offsetY: (cy - box.y - box.h / 2) / box.h,
            };
          }
        }),

      setMode: (key, mode) =>
        set((s) => {
          const b = s.booklet!;
          if (mode === 'full' && !fullAllowed(b, key)) return;
          surf(b, key).mode = mode;
          s.sel = { surface: key, page: mode === 'full' ? 'full' : key === 'cover' ? 'right' : 'left', slot: null };
        }),
      setLayout: (key, page, layoutId) =>
        set((s) => {
          const sp = surf(s.booklet!, key);
          const old = sp[page];
          // conserva las fotos por orden de recuadro
          sp[page] = { ...newPage(layoutId, old.frames), spacing: old.spacing };
          s.sel.slot = null;
        }),
      placePhotoIn: (t, photoId) =>
        set((s) => {
          const f = frameAt(s.booklet!, t);
          if (!f) return;
          f.photoId = photoId;
          resetFraming(f);
          s.sel = { ...t };
          s.armed = null;
        }),
      swapFrames: (a, b) =>
        set((s) => {
          const fa = frameAt(s.booklet!, a);
          const fb = frameAt(s.booklet!, b);
          if (!fa || !fb || fa === fb) return;
          const pick = (f: Frame) => ({ photoId: f.photoId, fit: f.fit, rotation: f.rotation, flipX: f.flipX });
          const pa = pick(fa);
          Object.assign(fa, pick(fb));
          Object.assign(fb, pa);
          // el encuadre de un recuadro no tiene sentido en otro de distinta forma
          resetFraming(fa);
          resetFraming(fb);
          s.sel = { ...b };
        }),
      updateFrame: (t, patch) =>
        set((s) => {
          const f = frameAt(s.booklet!, t);
          if (f) Object.assign(f, patch);
        }),
      clearFrame: (t) =>
        set((s) => {
          const f = frameAt(s.booklet!, t);
          if (!f) return;
          Object.assign(f, newFrame(f.slot));
        }),

      setSpacing: (scope, patch) =>
        set((s) => {
          const b = s.booklet!;
          if (scope === 'global') return void Object.assign(b.spacing, patch);
          const sp = surf(b, s.sel.surface);
          const target: { spacing?: Partial<Spacing> } = scope === 'spread' ? sp : (sp[s.sel.page] as Page);
          target.spacing = { ...target.spacing, ...patch };
        }),
      clearSpacing: (scope) =>
        set((s) => {
          if (scope === 'global') return;
          const sp = surf(s.booklet!, s.sel.surface);
          if (scope === 'spread') delete sp.spacing;
          else delete sp[s.sel.page].spacing;
        }),
    })),
    {
      partialize: (s) => ({ booklet: s.booklet }),
      equality: (a, b) => a.booklet === b.booklet,
      limit: 500,
      // los cambios seguidos de un mismo control (teclear un margen, arrastrar un deslizador) cuentan como un solo paso
      handleSet: (handleSet) => {
        let lastKey: string | null = null;
        let last = 0;
        return (...args: Parameters<typeof handleSet>) => {
          const now = Date.now();
          if (!(mergeKey && mergeKey === lastKey && now - last < 800)) handleSet(...args);
          lastKey = mergeKey;
          last = now;
        };
      },
    },
  ),
);

export const undo = () => useEditor.temporal.getState().undo();
export const redo = () => useEditor.temporal.getState().redo();

/** Hueco para completar la hoja antes de exportar. */
export function paddedBooklet(b: Booklet): Booklet {
  return { ...b, spreads: padSpreads(b.spreads, blankSpread) };
}
