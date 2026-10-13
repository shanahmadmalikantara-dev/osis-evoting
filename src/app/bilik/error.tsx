"use client";

import { Button } from "@/components/ui/Button";

// A full reload is the most reliable recovery on a kiosk laptop.
export default function BilikError() {
  return (
    <div role="alert" className="flex flex-1 items-center justify-center p-8">
      <div className="manila flex max-w-xl flex-col items-center gap-6 px-10 py-12 text-center shadow-card-lift">
        <span className="rubber-stamp px-4 py-1 text-lg">Jejak terputus</span>
        <h1 className="font-display text-5xl font-black">GAGAL MEMUAT</h1>
        <p className="font-type text-lg text-ink">Periksa koneksi internet, lalu tekan tombol di bawah.</p>
        <Button size="xl" onClick={() => window.location.reload()}>
          Muat ulang
        </Button>
      </div>
    </div>
  );
}
