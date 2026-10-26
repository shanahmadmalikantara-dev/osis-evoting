"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { PaperClip } from "@/components/ui/PaperClip";

// Accessible modal using the native <dialog> element (focus trap and Esc handled by the browser).
// Styled as a manila case folder with a tab and a paper clip.
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
      className="m-auto max-h-[94vh] w-[min(92vw,600px)] overflow-y-auto bg-transparent p-2 text-ink backdrop:bg-[#140b05]/70"
    >
      {open ? (
        <div className="relative pt-7">
          <span aria-hidden className="manila absolute left-6 top-0 h-9 w-44 rounded-t-[6px] shadow-none" />
          <div className="manila relative rounded-modal p-6 shadow-card-lift sm:p-8">
            <PaperClip />
            {children}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
