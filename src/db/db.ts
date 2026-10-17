import Dexie, { type Table } from 'dexie';
import type { Booklet, Photo } from '../model/types';

export interface BookletRow {
  id: string;
  title: string;
  updatedAt: number;
  data: Booklet;
}

export interface PhotoRow extends Photo {
  blob: Blob;
  preview: Blob;
  thumb: Blob;
}

class LibritosDB extends Dexie {
  booklets!: Table<BookletRow, string>;
  photos!: Table<PhotoRow, string>;

  constructor() {
    super('libritos');
    this.version(1).stores({
      booklets: 'id, updatedAt',
      photos: 'id, bookletId',
    });
  }
}

export const db = new LibritosDB();

export function saveBooklet(b: Booklet) {
  return db.booklets.put({ id: b.id, title: b.title, updatedAt: Date.now(), data: b });
}

export async function deleteBooklet(id: string) {
  await db.transaction('rw', db.booklets, db.photos, async () => {
    await db.photos.where('bookletId').equals(id).delete();
    await db.booklets.delete(id);
  });
}
