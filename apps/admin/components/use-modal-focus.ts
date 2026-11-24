"use client";
import { useEffect, useRef } from "react";

/** Keep keyboard focus and scrolling inside the current editing workspace. */
export function useModalFocus(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const dialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).at(-1);
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.tabIndex = -1; dialog.focus();
    function keyboard(event: KeyboardEvent) {
      // A confirmation can be opened above an editor; leave its keyboard and
      // Escape handling to the top-layer dialog without closing the editor.
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") { event.preventDefault(); close.current(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const elements = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
      const first = elements[0], last = elements.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keyboard); if (previous?.isConnected) previous.focus(); };
  }, [open]);
}
