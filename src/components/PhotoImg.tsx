import { placePhoto } from '../model/geometry';
import { photoUrl } from '../lib/photos';
import type { Frame, Photo, Rect } from '../model/types';

interface Props {
  rect: Pick<Rect, 'w' | 'h'>;
  k: number;
  photo: Photo;
  frame: Pick<Frame, 'fit' | 'offsetX' | 'offsetY' | 'scale' | 'rotation' | 'flipX'>;
  kind?: 'preview' | 'thumb';
}

/** La foto colocada dentro de su recuadro, igual que se rasteriza en el PDF. */
export function PhotoImg({ rect, k, photo, frame, kind = 'preview' }: Props) {
  const pl = placePhoto(rect, photo, frame);
  return (
    <img
      src={photoUrl(photo.id, kind)}
      alt=""
      draggable={false}
      className="pointer-events-none absolute select-none"
      style={{
        left: (pl.cx - pl.iw / 2) * k,
        top: (pl.cy - pl.ih / 2) * k,
        width: pl.iw * k,
        height: pl.ih * k,
        maxWidth: 'none',
        transform: `rotate(${frame.rotation}deg) scaleX(${frame.flipX ? -1 : 1})`,
      }}
    />
  );
}
