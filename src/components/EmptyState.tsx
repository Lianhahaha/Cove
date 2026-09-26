import type { ComponentChildren } from 'preact';

export function EmptyState({ icon, title, children }: { icon: ComponentChildren; title: string; children?: ComponentChildren }) {
  return (
    <div class="flex flex-col items-center text-center px-6 py-16 max-w-sm mx-auto">
      <div class="w-12 h-12 rounded-2xl bg-accent-fill text-accent grid place-items-center mb-4">{icon}</div>
      <h2 class="font-semibold">{title}</h2>
      {children && <div class="text-sm text-subtle mt-1.5">{children}</div>}
    </div>
  );
}
