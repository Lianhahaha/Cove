/**
 * Keeps the screen on while a focus session runs, so the timer stays visible
 * on a phone. The browser releases the lock whenever the page is hidden, so a
 * visibility listener takes it again when the user comes back to a running run.
 */

interface Sentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

interface WakeLockLike {
  request(type: 'screen'): Promise<Sentinel>;
}

const wl: WakeLockLike | undefined =
  typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;

let sentinel: Sentinel | null = null;
let wanted = false;

async function acquire() {
  if (!wanted || sentinel || !wl) return;
  let s: Sentinel;
  try {
    s = await wl.request('screen');
  } catch {
    /* unsupported or refused: the session just shows normally */
    return;
  }
  sentinel = s;
  s.addEventListener('release', () => {
    if (sentinel === s) sentinel = null;
  });
}

async function release() {
  const s = sentinel;
  sentinel = null;
  try {
    await s?.release();
  } catch {
    /* already gone */
  }
}

/** Asks for a screen wake lock while `on`, releasing it otherwise. */
export function keepScreenAwake(on: boolean) {
  wanted = on;
  if (on) void acquire();
  else void release();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted) void acquire();
  });
}
