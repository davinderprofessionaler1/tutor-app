"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type DialogOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};
type PromptOptions = DialogOptions & { inputLabel: string; defaultValue?: string };
type Request = {
  id: number;
  mode: "confirm" | "prompt";
  options: PromptOptions;
  resolve: (value: string | null) => void;
};
type DialogContextValue = {
  confirm: (options: DialogOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};
const DialogContext = createContext<DialogContextValue | null>(null);

/** One accessible, non-blocking confirmation style for the whole admin. */
export function ActionDialogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [request, setRequest] = useState<Request | null>(null);
  const active = useRef<Request | null>(null);
  const sequence = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const backdropPress = useRef(false);
  const labelId = useId();
  const finish = useCallback((id: number, value: string | null) => {
    if (active.current?.id !== id) return;
    const previous = active.current;
    active.current = null;
    setRequest(null);
    previous.resolve(value);
  }, []);
  const ask = useCallback((mode: Request["mode"], options: DialogOptions | PromptOptions) => {
    // Ignore repeated clicks instead of replacing an unresolved confirmation.
    if (active.current) return Promise.resolve(null);
    return new Promise<string | null>((resolve) => {
      const next: Request = { id: ++sequence.current, mode, options: { inputLabel: "", ...options }, resolve };
      active.current = next;
      setRequest(next);
    });
  }, []);
  const value = useMemo<DialogContextValue>(() => ({
    confirm: async (options) => (await ask("confirm", options)) !== null,
    prompt: (options) => ask("prompt", options),
  }), [ask]);

  useEffect(() => () => {
    if (active.current) finish(active.current.id, null);
  }, [pathname, finish]);

  useEffect(() => {
    const node = dialog.current;
    if (!request || !node) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Native dialog supplies focus trapping, an inert background and top-layer
    // placement, without blocking the classroom's media or heartbeat code.
    node.showModal();
    if (request.mode === "prompt") { input.current?.focus(); input.current?.select(); }
    else cancel.current?.focus();
    return () => {
      if (node.open) node.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [request]);

  return <DialogContext.Provider value={value}>
    {children}
    {request && <dialog
      ref={dialog}
      className={`action-dialog action-dialog-${request.options.tone ?? "default"}`}
      aria-labelledby={`${labelId}-title`}
      aria-describedby={`${labelId}-description`}
      onCancel={(event) => { event.preventDefault(); finish(request.id, null); }}
      onClose={() => finish(request.id, null)}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])');
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onPointerDown={(event) => { backdropPress.current = event.target === event.currentTarget; }}
      onClick={(event) => { if (backdropPress.current && event.target === event.currentTarget) finish(request.id, null); }}
    >
      <form onSubmit={(event) => { event.preventDefault(); finish(request.id, request.mode === "prompt" ? input.current?.value ?? "" : "confirmed"); }}>
        <header className="action-dialog-header">
          <span className="action-dialog-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4m0 3h.01"/></svg></span>
          <button type="button" className="action-dialog-close" aria-label="Close confirmation" onClick={() => finish(request.id, null)}>×</button>
          <span className="action-dialog-eyebrow">{request.mode === "prompt" ? "PAYMENT DETAILS" : "PLEASE CONFIRM"}</span>
          <h2 id={`${labelId}-title`}>{request.options.title}</h2>
          <p id={`${labelId}-description`}>{request.options.description}</p>
        </header>
        {request.mode === "prompt" && <div className="action-dialog-input"><label htmlFor={`${labelId}-input`}>{request.options.inputLabel}</label><input ref={input} id={`${labelId}-input`} type="text" defaultValue={request.options.defaultValue ?? ""} maxLength={200} autoComplete="off" /></div>}
        <footer className="action-dialog-footer">
          <button ref={cancel} type="button" className="secondary-action" onClick={() => finish(request.id, null)}>{request.options.cancelLabel ?? "Cancel"}</button>
          <button type="submit" className="primary-action">{request.options.confirmLabel}</button>
        </footer>
      </form>
    </dialog>}
  </DialogContext.Provider>;
}

export function useActionDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("useActionDialog must be used inside ActionDialogProvider.");
  return context;
}
