import { X } from 'lucide-preact';
import { dismissToast, toasts } from '../lib/toast';

export function Toasts() {
  return (
    <div
      class="fixed z-50 inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 flex flex-col items-center gap-2 px-4 pointer-events-none"
      aria-live="polite"
    >
      {toasts.value.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          class={`pointer-events-auto card shadow-lg flex items-center gap-3 pl-4 pr-1.5 py-1.5 max-w-md w-full sm:w-auto text-sm ${
            t.tone === 'error' ? 'border-danger text-danger' : ''
          }`}
        >
          <span class="flex-1 py-1">{t.message}</span>
          {t.action && (
            <button
              class="btn btn-soft min-h-8"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button class="icon-btn w-8 h-8" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
