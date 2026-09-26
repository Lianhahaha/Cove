import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { House, Plus, Search, SquareCheck, Menu } from 'lucide-preact';
import { Nav } from './Nav';
import { Toasts } from './Toasts';
import { CaptureSheet } from './CaptureSheet';
import { ItemDetail } from './ItemDetail';
import { menuOpen, openCapture } from '../state';

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

export function Shell({ children }: { children: ComponentChildren }) {
  return (
    <div class="min-h-dvh flex">
      <aside class="hidden md:block w-64 shrink-0 sticky top-0 h-dvh border-r border-border bg-surface">
        <Nav />
      </aside>
      <div class="flex-1 min-w-0 flex flex-col">
        <main class="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-10">{children}</main>
      </div>
      <BottomNav />
      <MobileMenu />
      <ItemDetail />
      <CaptureSheet />
      <Toasts />
    </div>
  );
}
