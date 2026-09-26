import type { ComponentChildren } from 'preact';

export function EmptyState({ icon, title, children }: { icon: ComponentChildren; title: string; children?: ComponentChildren }) {
  return (
    <div class="flex flex-col items-center text-center px-6 py-10 md:py-16 max-w-sm mx-auto">
      <div class="w-11 h-11 rounded-2xl bg-accent-fill text-accent grid place-items-center mb-3">{icon}</div>
      <h2 class="font-display text-lg font-medium">{title}</h2>
      {children && <div class="text-sm text-subtle mt-1.5">{children}</div>}
    </div>
  );
}
