import type { ComponentChildren } from 'preact';

interface Props {
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  actions?: ComponentChildren;
}

/** On phones the menu lives under More in the tab bar, so the header only carries the title and actions. */
export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header class="page-header sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-border pt-[env(safe-area-inset-top)]">
      <div class="flex items-center gap-2 px-3 md:px-6 h-14">
        <div class="min-w-0 flex-1">
          <h1 class="font-display text-xl font-medium tracking-[-0.01em] truncate leading-tight">{title}</h1>
          {subtitle && <p class="text-xs text-subtle truncate mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div class="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
