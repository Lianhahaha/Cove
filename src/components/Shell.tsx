import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { House, Plus, Search, SquareCheck, Menu, WifiOff } from 'lucide-preact';
import { Nav } from './Nav';
import { Toasts } from './Toasts';
import { CaptureSheet } from './CaptureSheet';
import { ItemDetail } from './ItemDetail';
import { Palette } from './Palette';
import { ShortcutsHelp, useShortcuts } from './Shortcuts';
import { capture, menuOpen, openCapture } from '../state';
import { filesFromClipboard } from '../lib/files';
import { online } from '../lib/pwa';

function BottomNav() {
  const { path } = useLocation();
  const tab = (href: string, label: string, icon: ComponentChildren) => {
    const active = href === '/' ? path === '/' : path.startsWith(href);
    return (
      <a
        href={href}
        aria-current={active ? 'page' : undefined}
        class={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] ${active ? 'text-accent' : 'text-subtle'}`}
      >
        {icon}
        {label}
      </a>
    );
  };
  return (
    <nav
      class="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Tabs"
    >
      <div class="flex h-16 items-stretch">
        {tab('/', 'Home', <House size={20} />)}
        {tab('/tasks', 'Tasks', <SquareCheck size={20} />)}
        <div class="flex-1 grid place-items-center">
          <button
            class="w-12 h-12 rounded-2xl bg-accent text-on-accent grid place-items-center shadow-md active:scale-95 transition-transform"
            aria-label="Capture something"
            onClick={() => openCapture()}
          >
            <Plus size={24} />
          </button>
        </div>
        {tab('/search', 'Search', <Search size={20} />)}
        <button class="flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] text-subtle" onClick={() => (menuOpen.value = true)}>
          <Menu size={20} />
          More
        </button>
      </div>
    </nav>
  );
}

function MobileMenu() {
  useEffect(() => {
    if (!menuOpen.value) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (menuOpen.value = false);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [menuOpen.value]);
  if (!menuOpen.value) return null;
  return (
    <div class="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="absolute inset-0 bg-black/40" onClick={() => (menuOpen.value = false)} />
      <div class="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface border-r border-border pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl">
        <Nav />
      </div>
    </div>
  );
}

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** Files dropped or pasted anywhere outside an open item start a new capture. */
function useGlobalFileCapture() {
  useEffect(() => {
    const busy = () => capture.value.open || new URLSearchParams(location.search).has('item');
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const files = [...(e.dataTransfer?.files ?? [])];
      if (!files.length) return;
      // Always stop the browser from navigating away to the dropped file.
      e.preventDefault();
      if (!busy()) openCapture({ files });
    };
    const onPaste = (e: ClipboardEvent) => {
      if (busy() || isEditable(e.target)) return;
      const files = filesFromClipboard(e);
      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (files.length) openCapture({ files });
      else if (text) openCapture({ text });
      else return;
      e.preventDefault();
    };
    addEventListener('dragover', onDragOver);
    addEventListener('drop', onDrop);
    addEventListener('paste', onPaste);
    return () => {
      removeEventListener('dragover', onDragOver);
      removeEventListener('drop', onDrop);
      removeEventListener('paste', onPaste);
    };
  }, []);
}

export function Shell({ children }: { children: ComponentChildren }) {
  useGlobalFileCapture();
  useShortcuts();
  return (
    <div class="min-h-dvh flex">
      <aside class="hidden md:block w-64 shrink-0 sticky top-0 h-dvh border-r border-border bg-surface">
        <Nav />
      </aside>
      <div class="flex-1 min-w-0 flex flex-col">
        {!online.value && (
          <div class="bg-surface3 text-muted text-xs flex items-center justify-center gap-2 py-1.5 px-4" role="status">
            <WifiOff size={14} /> Offline. Everything still works; link previews will load when you're back.
          </div>
        )}
        <main class="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-10">{children}</main>
      </div>
      <BottomNav />
      <MobileMenu />
      <ItemDetail />
      <CaptureSheet />
      <Palette />
      <ShortcutsHelp />
      <Toasts />
    </div>
  );
}
