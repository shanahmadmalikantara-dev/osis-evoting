import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PaperClip } from "@/components/ui/PaperClip";
import type { Candidate } from "@/lib/types";
import { Field, Folder, inputClass } from "./Shell";
import { DEFAULT_SITE_URL, api, errorText, fetchCandidates } from "./store";

const BOOTHS = [1, 2, 3, 4, 5, 6, 7, 8];

// First run (H-1, with internet): booth number, candidate list from the website, officer PIN.
export function Setup({ onDone }: { onDone: () => void }) {
  const [bilik, setBilik] = useState<number | null>(null);
  const [siteUrl, setSiteUrl] = useState(DEFAULT_SITE_URL);
  const [synced, setSynced] = useState<{ candidates: Candidate[]; syncedAt: string } | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pinOk = /^\d{4,8}$/.test(pin);
  const ready = bilik !== null && synced !== null && pinOk && pin === pin2;

  async function sync() {
    setBusy(true);
    setError(null);
    try {
      setSynced(await fetchCandidates(siteUrl));
    } catch (e) {
      setSynced(null);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await api.setup(bilik, pin, siteUrl.trim(), synced.candidates, synced.syncedAt);
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Folder tab="Persiapan bilik cadangan" wide>
        <PaperClip />
        <div className="flex flex-col gap-1">
          <span className="rubber-stamp w-fit -rotate-2 px-2 py-0.5 text-xs">Sekali saja · H-1</span>
          <h1 className="font-display text-4xl font-black leading-tight sm:text-5xl">Siapkan bilik cadangan</h1>
          <p className="font-type text-ink">
            Lakukan ini sehari sebelum pemilihan, saat laptop masih terhubung internet. Setelah itu aplikasi ini bisa dipakai
            tanpa internet.
          </p>
        </div>

        <Step n={1} title="Laptop ini bilik nomor berapa?">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {BOOTHS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={bilik === n}
                onClick={() => setBilik(n)}
                className={`rounded-sticker border-2 border-ink py-3 font-display text-2xl font-black shadow-sticker transition-colors ${
                  bilik === n ? "bg-surface-dark text-on-dark" : "bg-surface hover:bg-manila"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </Step>

        <Step n={2} title="Ambil data paslon dari website">
          <Field label="Alamat website">
            <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} className={inputClass} spellCheck={false} />
          </Field>
          <Button variant="secondary" onClick={sync} disabled={busy}>
            {busy && !synced ? "Mengambil..." : synced ? "Ambil ulang" : "Ambil data paslon"}
          </Button>
          {synced ? (
            <ul className="grid gap-2 sm:grid-cols-2" aria-label="Paslon tersimpan">
              {synced.candidates.map((c) => (
                <li key={c.id} className="paper flex items-center gap-3 px-3 py-2 font-type">
                  <span className="rubber-stamp grid size-9 shrink-0 place-items-center rounded-full font-display text-lg font-black">
                    {c.nomor_urut}
                  </span>
                  <span className="leading-tight">
                    {c.nama_ketua} &amp; {c.nama_wakil}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Step>

        <Step n={3} title="Buat PIN petugas (4 sampai 8 angka)">
          <p className="font-type text-sm text-ink-soft">
            PIN dipakai untuk membuka/menutup voting cadangan dan melihat hasil. Jangan beri tahu pemilih.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="PIN">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className={inputClass}
              />
            </Field>
            <Field label="Ulangi PIN">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
                className={inputClass}
              />
            </Field>
          </div>
          {pin2 && pin !== pin2 ? <p className="font-type text-sm text-pink">PIN belum sama.</p> : null}
        </Step>

        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button size="xl" onClick={save} disabled={!ready || busy}>
          Simpan dan selesai
        </Button>
      </Folder>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-dashed border-ink/30 pt-5">
      <h2 className="flex items-center gap-3 font-display text-2xl font-black">
        <span className="grid size-8 place-items-center rounded-full border-2 border-pink font-mono text-sm text-pink">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
