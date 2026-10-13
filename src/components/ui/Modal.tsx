"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Accessible modal using the native <dialog> element (focus trap and Esc handled by the browser).
export function Modal({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[92vh] w-[min(92vw,580px)] overflow-y-auto rounded-modal border-2 border-ink bg-surface p-0 text-ink shadow-card-lift backdrop:bg-ink/60"
    >
      {open ? <div className="p-6 sm:p-8">{children}</div> : null}
    </dialog>
  );
}
