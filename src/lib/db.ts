import Dexie, { type EntityTable } from 'dexie';
import type { Item, Setting, Space, StoredFile } from './types';

export class CoveDB extends Dexie {
  items!: EntityTable<Item, 'id'>;
  spaces!: EntityTable<Space, 'id'>;
  files!: EntityTable<StoredFile, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'cove') {
    super(name);
    // Booleans can't be indexed in IndexedDB, so flags are filtered in memory.
    this.version(1).stores({
      items: 'id, spaceId, status, due, createdAt, updatedAt, deletedAt, *tags',
      spaces: 'id, order, deletedAt',
      files: 'id, itemId, createdAt',
      settings: 'key',
    });
  }
}

export const db = new CoveDB();
