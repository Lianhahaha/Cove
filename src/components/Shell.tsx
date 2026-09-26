import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { House, Plus, Search, SquareCheck, Menu, WifiOff } from 'lucide-preact';
import { Nav } from './Nav';
import { Toasts } from './Toasts';
import { ConfirmHost } from './Confirm';
import { CaptureSheet } from './CaptureSheet';
import { useLazyComponent } from './lazy';
import { FocusPill } from './FocusTimer';
import { useItemNav } from '../lib/nav';
import { ShortcutsHelp, useShortcuts } from './Shortcuts';
import { capture, menuOpen, openCapture, paletteOpen } from '../state';
import { filesFromClipboard } from '../lib/files';
import { online } from '../lib/pwa';

function TabFace({ active, label, icon: Icon }: { active: boolean; label: string; icon: typeof House }) {
  return (
    <>
      <span class="tab-pill" data-active={active || undefined}>
        <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
      </span>
      <span class="tab-label" data-active={active || undefined}>{label}</span>
    </>
  );
}

function BottomNav() {
  const { path } = useLocation();
  const isOn = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  // Pages without their own tab (Inbox, spaces, Settings…) are reached through More, so More shows as current.
  const inMore = !['/', '/tasks', '/search'].some(isOn);
  const tab = (href: string, label: string, icon: typeof House) => (
    <a href={href} class="tab" aria-current={isOn(href) ? 'page' : undefined}>
      <TabFace active={isOn(href)} label={label} icon={icon} />
    </a>
  );
  return (
    <nav
      class="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Tabs"
    >
      <div class="flex h-[3.75rem] items-stretch px-1">
        {tab('/', 'Home', House)}
        {tab('/tasks', 'Tasks', SquareCheck)}
        <div class="flex-1 grid place-items-center">
          <button class="create-btn" aria-label="Capture something" onClick={() => openCapture()}>
            <Plus size={22} strokeWidth={2.25} />
          </button>
        </div>
        {tab('/search', 'Search', Search)}
        <button class="tab" aria-haspopup="dialog" aria-expanded={menuOpen.value} onClick={() => (menuOpen.value = true)}>
          <TabFace active={inMore || menuOpen.value} label="More" icon={Menu} />
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
  const { openId } = useItemNav();
  const ItemDetail = useLazyComponent(!!openId, () => import('./ItemDetail').then((m) => m.ItemDetail));
  const Palette = useLazyComponent(paletteOpen.value, () => import('./Palette').then((m) => m.Palette));
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
      {ItemDetail && <ItemDetail />}
      <CaptureSheet />
      {Palette && <Palette />}
      <ShortcutsHelp />
      <FocusPill />
      <ConfirmHost />
      <Toasts />
    </div>
  );
}
