import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { CircleHelp } from 'lucide-preact';

/** True while a help tip is open, so Escape closes the tip before any dialog under it. */
export const infoTipOpen = () => !!document.querySelector('.infotip:popover-open');

/**
 * A small "?" beside a label that explains the feature. With a mouse it shows on
 * hover; a tap or click pins it open until you tap elsewhere or press Escape.
 * The tip lives in the top layer, so scrolling panels and dialogs can't clip it.
 */
export function InfoTip({ label, children }: { label: string; children: ComponentChildren }) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const hideTimer = useRef<number>();

  /** Below the "?", or above when there's no room, and always inside the screen. */
  function place() {
    const b = btn.current!.getBoundingClientRect();
    const t = tip.current!;
    const gap = 6;
    const pad = 12;
    const left = Math.min(Math.max(b.left + b.width / 2 - t.offsetWidth / 2, pad), innerWidth - t.offsetWidth - pad);
    const below = b.bottom + gap;
    const top = below + t.offsetHeight > innerHeight - pad ? Math.max(pad, b.top - gap - t.offsetHeight) : below;
    t.style.left = `${left}px`;
    t.style.top = `${top}px`;
  }

  function show(pin: boolean) {
    clearTimeout(hideTimer.current);
    if (pin) pinned.current = true;
    const t = tip.current;
    if (!t || t.matches(':popover-open')) return;
    t.showPopover();
    place();
    setOpen(true);
  }

  function hide() {
    clearTimeout(hideTimer.current);
    pinned.current = false;
    if (tip.current?.matches(':popover-open')) tip.current.hidePopover();
    setOpen(false);
  }

  const hideSoon = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && !pinned.current) hideTimer.current = window.setTimeout(hide, 150);
  };

  // While open, Escape, a tap anywhere else, scrolling or resizing close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Stops here, so the item panel or menu underneath stays open.
      e.stopPropagation();
      hide();
      btn.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!btn.current?.contains(target) && !tip.current?.contains(target)) hide();
    };
    addEventListener('keydown', onKey, true);
    addEventListener('pointerdown', onDown, true);
    addEventListener('scroll', hide, true);
    addEventListener('resize', hide);
    return () => {
      removeEventListener('keydown', onKey, true);
      removeEventListener('pointerdown', onDown, true);
      removeEventListener('scroll', hide, true);
      removeEventListener('resize', hide);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  return (
    <>
      <button
        ref={btn}
        type="button"
        class="infotip-btn"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={id}
        onClick={() => (open && pinned.current ? hide() : show(true))}
        // Only a real mouse hovers; on touch, the tap alone opens it.
        onPointerEnter={(e) => e.pointerType === 'mouse' && show(false)}
        onPointerLeave={hideSoon}
      >
        <CircleHelp size={14} aria-hidden="true" />
      </button>
      <div ref={tip} id={id} popover="manual" role="tooltip" class="infotip" onPointerEnter={() => clearTimeout(hideTimer.current)} onPointerLeave={hideSoon}>
        {children}
      </div>
    </>
  );
}

/** A field label with a "?" that explains the feature. Without `htmlFor` it's a plain caption. */
export function FieldLabel({ text, htmlFor, info }: { text: string; htmlFor?: string; info: ComponentChildren }) {
  return (
    <div class="label-row">
      {htmlFor ? (
        <label class="label" for={htmlFor}>
          {text}
        </label>
      ) : (
        <span class="label">{text}</span>
      )}
      <InfoTip label={text}>{info}</InfoTip>
    </div>
  );
}
