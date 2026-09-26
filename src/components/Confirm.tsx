import { useEffect, useRef } from 'preact/hooks';
import { confirmRequest } from '../lib/confirm';
import { Modal } from './Modal';

/** Shows the question from confirmAction(). Cancel has focus, so Enter or Escape keeps things safe. */
export function ConfirmHost() {
  const req = confirmRequest.value;
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (req) cancel.current?.focus();
  }, [req]);
  if (!req) return null;

  const answer = (ok: boolean) => {
    confirmRequest.value = null;
    req.resolve(ok);
  };

  return (
    <Modal title={req.title} size="sm" onClose={() => answer(false)}>
      {req.body && <p class="text-sm text-muted pt-1">{req.body}</p>}
      <div class="flex justify-end gap-2 mt-5">
        <button ref={cancel} class="btn btn-ghost" onClick={() => answer(false)}>
          Cancel
        </button>
        <button class="btn btn-danger" onClick={() => answer(true)}>
          {req.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
