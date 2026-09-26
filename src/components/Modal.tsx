import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { X } from 'lucide-preact';

interface Props {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  /** Bottom sheet on phones, centered dialog on larger screens. */
  size?: 'sm' | 'md' | 'lg';
}

const WIDTH = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

export function Modal({ title, onClose, children, size = 'md' }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    addEventListener('keydown', onKey, true);
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', onKey, true);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, []);

  return (
    <div class="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div class="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panel}
        class={`relative w-full ${WIDTH[size]} bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]`}
      >
        <div class="flex items-center justify-between px-4 pt-3 pb-1">
          <h2 class="font-semibold">{title}</h2>
          <button class="icon-btn -mr-2" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div class="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
