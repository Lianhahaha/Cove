import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { menuOpen, openCapture, paletteOpen, shortcutsOpen, capture } from '../state';
import { Modal } from './Modal';

// I still works for Unsorted, which used to be called Inbox.
const GO: Record<string, string> = { h: '/', u: '/unsorted', i: '/unsorted', t: '/tasks', a: '/all', f: '/favorites', s: '/settings' };

const SHORTCUTS: [string, string][] = [
  ['Ctrl / ⌘ + K', 'Command palette'],
  ['N', 'New item'],
  ['/', 'Search'],
  ['G then H', 'Home'],
  ['G then U', 'Unsorted'],
  ['G then T', 'Tasks'],
  ['G then A', 'All items'],
  ['G then F', 'Favorites'],
  ['G then S', 'Settings'],
  ['Esc', 'Close a panel or dialog'],
  ['Enter', 'Save in the capture box'],
  ['Shift + Enter', 'New line in the capture box'],
  ['?', 'This list'],
];

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** App-wide keyboard shortcuts. Single keys only fire when you're not typing. */
export function useShortcuts() {
  const { route } = useLocation();
  useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        paletteOpen.value = !paletteOpen.value;
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (paletteOpen.value || capture.value.open || shortcutsOpen.value || menuOpen.value) return;
      // Any other dialog or the item panel: a stray G then H mustn't navigate away under an open confirm.
      if (document.querySelector('[aria-modal="true"]')) return;
      const key = e.key.toLowerCase();
      if (pendingG && Date.now() - pendingG < 1200 && GO[key]) {
        e.preventDefault();
        pendingG = 0;
        route(GO[key]);
        return;
      }
      pendingG = 0;
      if (key === 'g') pendingG = Date.now();
      else if (key === 'n' || key === 'c') {
        e.preventDefault();
        openCapture();
      } else if (key === '/') {
        e.preventDefault();
        // Already searching: keep the query and jump back into the box.
        if (location.pathname === '/search') document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
        else route('/search');
      } else if (e.key === '?') {
        e.preventDefault();
        shortcutsOpen.value = true;
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
}

export function ShortcutsHelp() {
  if (!shortcutsOpen.value) return null;
  return (
    <Modal title="Keyboard shortcuts" size="sm" onClose={() => (shortcutsOpen.value = false)}>
      <dl class="divide-y divide-border">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={keys} class="flex items-center justify-between py-2 text-sm">
            <dt class="text-muted">{label}</dt>
            <dd class="kbd text-xs">{keys}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
