import type { ComponentChildren } from 'preact';
import { Menu } from 'lucide-preact';
import { menuOpen } from '../state';

interface Props {
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  actions?: ComponentChildren;
}

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header class="sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-border pt-[env(safe-area-inset-top)]">
      <div class="flex items-center gap-2 px-3 md:px-6 h-12 md:h-14">
        <button class="icon-btn md:hidden -ml-2" aria-label="Open menu" onClick={() => (menuOpen.value = true)}>
          <Menu size={20} />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="font-display text-lg font-medium truncate leading-tight">{title}</h1>
          {subtitle && <p class="text-xs text-subtle truncate">{subtitle}</p>}
        </div>
        {actions && <div class="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
