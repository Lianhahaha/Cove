export type ItemKind = 'link' | 'note' | 'file';
export type TaskStatus = 'none' | 'todo' | 'doing' | 'done';
export type Priority = 0 | 1 | 2 | 3;

export interface ChecklistEntry {
  id: string;
  text: string;
  done: boolean;
}

export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly';
  /** Repeat every N days, weeks or months. */
  interval: number;
}

export interface LinkPreview {
  status: 'pending' | 'ok' | 'error';
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  fetchedAt?: number;
  error?: string;
}

export interface Item {
  id: string;
  kind: ItemKind;
  title: string;
  /** Markdown description. */
  body: string;
  url: string | null;
  preview: LinkPreview | null;
  /** null means the item sits in the Inbox. */
  spaceId: string | null;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  /** Private items are never sent to AI and are blurred in lists. */
  private: boolean;
  /** 'none' means the item is not a task. */
  status: TaskStatus;
  /** Epoch ms. Date-only dues are stored at local midnight. */
  due: number | null;
  dueHasTime: boolean;
  priority: Priority;
  checklist: ChecklistEntry[];
  recurrence: Recurrence | null;
  remindAt: number | null;
  estimateMins: number | null;
  completedAt: number | null;
  /** Minutes spent in focus sessions on this item. Missing on items made before the timer existed. */
  focusMins?: number;
  /** Manual sort position within a board column or list. */
  order: number;
  createdAt: number;
  updatedAt: number;
  /** Set when the item is in the trash. */
  deletedAt: number | null;
}

export interface Space {
  id: string;
  name: string;
  emoji: string;
  color: string;
  order: number;
  archived: boolean;
  /** Items in this space are never sent to AI. */
  aiExcluded: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface StoredFile {
  id: string;
  itemId: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}
