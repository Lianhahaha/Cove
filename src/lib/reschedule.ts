import { addDays, startOfDay } from './dates';

export type DuePreset = 'today' | 'tomorrow' | 'nextweek';

export const PRESET_LABELS: Record<DuePreset, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  nextweek: 'Next week',
};

/**
 * The timestamp a due preset points at. A timed task keeps its time of day, so
 * "tomorrow" on a 5pm lecture stays at 5pm; a date-only one lands at the start
 * of the day, like the one-tap chips in the item panel. "Next week" is next
 * Monday, as in quick add: a whole week away when today is already Monday.
 */
export function presetDue(preset: DuePreset, timeOfDay: { hours: number; minutes: number } | null, now = new Date()): number {
  const today = startOfDay(now);
  const day =
    preset === 'today'
      ? today
      : preset === 'tomorrow'
        ? addDays(today, 1)
        : addDays(today, ((8 - now.getDay()) % 7) || 7);
  if (timeOfDay) day.setHours(timeOfDay.hours, timeOfDay.minutes);
  return day.getTime();
}
