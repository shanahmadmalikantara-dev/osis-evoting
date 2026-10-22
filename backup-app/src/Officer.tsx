import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { PaperClip } from "@/components/ui/PaperClip";
import { Sticker } from "@/components/ui/Sticker";
import { Field, Folder, inputClass } from "./Shell";
import { RESET_PHRASE, api, errorText, fetchCandidates, type PublicState, type Status } from "./store";

type Confirm = { title: string; body: string; label: string; danger?: boolean; run: () => Promise<string | void> };

const STATUS_LABEL: Record<Status, { text: string; color: "yellow" | "green" | "blue" }> = {
  ready: { text: "Belum dibuka", color: "yellow" },
  open: { text: "Dibuka", color: "green" },
  closed: { text: "Ditutup", color: "blue" },
};

// Officer panel (after the PIN): open/close the backup booth, results, export, maintenance.
export function Officer({
  pin,
  state,
  onBack,
  onReport,
  onChanged,
}: {
  pin: string;
  state: PublicState;
  onBack: () => void;
  onReport: () => void;
  onChanged: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const status = STATUS_LABEL[state.status];

  async function run(action: () => Promise<string | void>) {
    setBusy(true);
    setNotice(null);
    try {
      const message = await action();
      if (message) setNotice({ tone: "success", text: message });
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
      setConfirm(null);
      await onChanged();
    }
  }

  const setStatus = (next: Status) => () => api.setStatus(pin, next);

  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Folder tab={`Bilik cadangan no. ${state.bilik}`} wide>
        <PaperClip />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="rubber-stamp w-fit -rotate-2 px-2 py-0.5 text-xs">Panel petugas</span>
            <h1 className="font-display text-4xl font-black leading-tight">Bilik cadangan {state.bilik}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-type text-xs uppercase tracking-widest text-ink-soft">Status</span>
            <Sticker color={status.color}>{status.text}</Sticker>
          </div>
        </div>

        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {state.status !== "open" ? (
            <Button
              size="xl"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: "Buka voting cadangan?",
                  body: "Pemilih bisa memilih di laptop ini. Suara disimpan di laptop ini saja, tidak dikirim ke website.",
                  label: "Ya, buka",
                  run: setStatus("open"),
                })
              }
            >
              Buka voting cadangan
            </Button>
          ) : (
            <Button
              size="xl"
              variant="danger"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: "Tutup voting cadangan?",
                  body: "Laptop ini berhenti menerima suara. Bisa dibuka lagi dengan PIN kalau masih diperlukan.",
                  label: "Ya, tutup",
                  danger: true,
                  run: setStatus("closed"),
                })
              }
            >
              Tutup voting cadangan
            </Button>
          )}
          <Button size="xl" variant="secondary" disabled={busy} onClick={onReport}>
            Lihat hasil &amp; cetak berita acara
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const folder = await api.exportFiles(pin);
                return `File rekap (CSV) dan salinan data suara disimpan di: ${folder}`;
              })
            }
          >
            Simpan file rekap (CSV)
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const siteUrl = state.site_url ?? "";
                const { candidates, syncedAt } = await fetchCandidates(siteUrl);
                await api.updateCandidates(pin, siteUrl, candidates, syncedAt);
                return `Data paslon diperbarui (${candidates.length} paslon).`;
              })
            }
          >
            Perbarui data paslon (butuh internet)
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-ink/30 pt-5">
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" disabled={busy} onClick={() => setResetOpen(true)}>
              Hapus suara di laptop ini
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => api.quit(pin)}>
              Tutup aplikasi
            </Button>
          </div>
          <Button disabled={busy} onClick={onBack}>
            Kembali ke bilik
          </Button>
        </div>

        <p className="font-type text-xs text-ink-soft">
          Data paslon terakhir diambil: {state.synced_at ? new Date(state.synced_at).toLocaleString("id-ID") : "-"}
        </p>
      </Folder>

      <Modal open={confirm !== null} onClose={() => !busy && setConfirm(null)} labelledBy="officer-confirm-title">
        {confirm ? (
          <div className="flex flex-col gap-5">
            <h2 id="officer-confirm-title" className="font-display text-3xl font-black leading-tight">
              {confirm.title}
            </h2>
            <p className="font-type text-ink">{confirm.body}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>
                Batal
              </Button>
              <Button variant={confirm.danger ? "danger" : "primary"} disabled={busy} onClick={() => run(confirm.run)}>
                {busy ? "Memproses..." : confirm.label}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ResetDialog
        open={resetOpen}
        pin={pin}
        onClose={() => setResetOpen(false)}
        onDone={async (count) => {
          setResetOpen(false);
          setNotice({ tone: "success", text: `${count} suara dipindahkan ke arsip. Laptop ini mulai dari nol lagi.` });
          await onChanged();
        }}
      />
    </div>
  );
}

// Clearing the laptop (e.g. after the H-1 test). The old file is archived, never destroyed.
function ResetDialog({
  open,
  pin,
  onClose,
  onDone,
}: {
  open: boolean;
  pin: string;
  onClose: () => void;
  onDone: (count: number) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setText("");
    setError(null);
    onClose();
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const count = await api.resetVotes(pin, text);
      setText("");
      await onDone(count);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} labelledBy="reset-title">
      <div className="flex flex-col gap-5">
        <span className="rubber-stamp w-fit -rotate-3 px-2 py-0.5 text-xs">Hati-hati</span>
        <h2 id="reset-title" className="font-display text-3xl font-black leading-tight">
          Hapus suara di laptop ini?
        </h2>
        <p className="font-type text-ink">
          Pakai ini hanya untuk membersihkan suara percobaan, atau setelah hasilnya sudah dicetak dan ditandatangani. File lama
          tetap disimpan di folder arsip. Ketik <strong className="font-mono">{RESET_PHRASE}</strong> untuk lanjut.
        </p>
        <Field label="Ketik konfirmasi">
          <input value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} uppercase`} disabled={busy} />
        </Field>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" disabled={busy} onClick={close}>
            Batal
          </Button>
          <Button variant="danger" disabled={busy || text.trim() !== RESET_PHRASE} onClick={submit}>
            Hapus
          </Button>
        </div>
      </div>
    </Modal>
  );
}
