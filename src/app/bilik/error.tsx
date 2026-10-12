"use client";

import { Button } from "@/components/ui/Button";

// A full reload is the most reliable recovery on a kiosk laptop.
export default function BilikError() {
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="font-display text-4xl">GAGAL MEMUAT</h1>
      <p className="font-hand text-2xl text-ink-soft">Periksa koneksi internet, lalu tekan tombol di bawah.</p>
      <Button size="xl" onClick={() => window.location.reload()}>
        Muat ulang
      </Button>
    </div>
  );
}
