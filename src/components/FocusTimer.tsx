import { useEffect, useState } from 'preact/hooks';
import { Pause, Play, Square, Timer } from 'lucide-preact';
import { FOCUS_PRESETS, focus, formatClock, pauseFocus, remainingMs, resumeFocus, startFocus, stopFocus } from '../lib/focus';
import { itemUrl, navigate } from '../lib/nav';

/** Floating timer shown on every page while a focus session or break runs. */
export function FocusPill() {
  const s = focus.value;
  if (!s) return null;
  const left = remainingMs(s);
  const paused = s.endsAt === null;
  const pct = 100 - (left / (s.minutes * 60_000)) * 100;
  return (
    <div
      class="fixed z-30 right-3 md:right-6 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 card shadow-xl flex items-center gap-1 pl-3 pr-1 py-1 overflow-hidden"
      role="timer"
      aria-label={`${s.mode === 'focus' ? 'Focus' : 'Break'}: ${formatClock(left)} left`}
    >
      <div class="absolute left-0 bottom-0 h-0.5" style={{ width: `${pct}%`, background: 'var(--c-chart)' }} />
      <button
        class="flex items-center gap-2 min-w-0 text-left"
        title={s.itemId ? 'Open the task' : undefined}
        onClick={() => s.itemId && navigate(itemUrl(location.pathname, Object.fromEntries(new URLSearchParams(location.search)), s.itemId))}
      >
        <Timer size={16} class={s.mode === 'focus' ? 'text-accent' : 'text-subtle'} />
        <span class="font-mono font-medium tabular-nums">{formatClock(left)}</span>
        <span class="text-xs text-subtle truncate max-w-32 hidden xs:inline">{s.mode === 'focus' ? s.title : 'Break'}</span>
      </button>
      <button class="icon-btn w-8 h-8" aria-label={paused ? 'Resume' : 'Pause'} onClick={() => (paused ? resumeFocus() : pauseFocus())}>
        {paused ? <Play size={15} /> : <Pause size={15} />}
      </button>
      <button class="icon-btn w-8 h-8" aria-label="Stop timer" onClick={stopFocus}>
        <Square size={14} />
      </button>
    </div>
  );
}

/** Start button with preset lengths, used in the item editor. */
export function FocusStarter({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const running = focus.value?.itemId === itemId;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Close on the next click anywhere, like the AI menu beside it; the menu's own buttons run first.
    const t = setTimeout(() => addEventListener('click', close, { once: true }));
    return () => {
      clearTimeout(t);
      removeEventListener('click', close);
    };
  }, [open]);

  return (
    <div class="relative">
      <button class={`icon-btn ${running ? 'text-accent' : ''}`} title="Focus timer" aria-label="Focus timer" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Timer size={18} />
      </button>
      {open && (
        <div class="absolute right-0 top-11 z-20 card shadow-xl p-1.5 w-48" role="menu">
          <p class="text-xs text-subtle px-2 py-1">Focus on this for</p>
          {FOCUS_PRESETS.map((m) => (
            <button
              key={m}
              role="menuitem"
              class="w-full text-left px-3 h-9 rounded-lg text-sm hover:bg-surface3"
              onClick={() => {
                setOpen(false);
                void startFocus(itemId, m);
              }}
            >
              {m} minutes
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
