import { db } from './db';
import { useLive } from './live';
import { minute } from './clock';
import { isActive, isOpenTask } from './queries';
import { dueBucket } from './dates';

export interface NavCounts {
  /** Unsorted items with nothing finished about them yet. */
  inbox: number;
  /** Open tasks that are overdue or due today. */
  due: number;
}

/** The counts beside Unsorted and Tasks, recounted each minute as tasks come due. */
export function useNavCounts(): NavCounts | undefined {
  const tick = minute.value;
  return useLive(async () => {
    const items = await db.items.filter((i) => isActive(i)).toArray();
    const now = new Date();
    return {
      inbox: items.filter((i) => i.spaceId === null && i.status !== 'done').length,
      due: items.filter((i) => isOpenTask(i) && ['overdue', 'today'].includes(dueBucket(i.due, i.dueHasTime, now))).length,
    };
  }, [tick]);
}
