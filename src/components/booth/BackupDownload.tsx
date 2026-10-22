"use client";

import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export const BACKUP_INSTALLER_PATH = "/unduh/Pemilu-OSIS-Cadangan-Setup.exe";

// Small corner button on the booth pages (owner decision, 22 Oct 2026): officers download the
// offline backup app for Windows from here. The link only exists inside the confirmation, so a
// voter cannot download it with one stray click.
export function BackupDownload() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-20 rounded-full bg-surface-dark/40 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-on-dark/80 transition-colors hover:bg-surface-dark"
      >
        Aplikasi cadangan
      </button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="backup-title">
        <div className="flex flex-col gap-5">
          <span className="rubber-stamp w-fit -rotate-3 px-2 py-0.5 text-xs">Khusus petugas</span>
          <h2 id="backup-title" className="font-display text-3xl font-black leading-tight sm:text-4xl">
            Unduh aplikasi cadangan?
          </h2>
          <p className="font-type text-ink">
            Aplikasi voting cadangan untuk laptop Windows, dipakai kalau internet atau website bermasalah. Suara disimpan di
            laptop itu saja. Pasang <strong>sehari sebelum pemilihan</strong>, karena saat internet mati aplikasi tidak bisa
            diunduh.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <a href={BACKUP_INSTALLER_PATH} download onClick={() => setOpen(false)} className={buttonClasses("primary", "lg")}>
              Ya, unduh
            </a>
          </div>
        </div>
      </Modal>
    </>
  );
}
