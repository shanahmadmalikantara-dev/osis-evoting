"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { deleteCandidate, saveCandidate } from "@/app/admin/(panel)/paslon/actions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { MAX_PHOTO_BYTES, PHOTO_BUCKET, PHOTO_TYPES } from "@/lib/photos";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { Candidate } from "@/lib/types";

type Editing = { mode: "new" } | { mode: "edit"; candidate: Candidate };

export function CandidateManager({ candidates, editable }: { candidates: Candidate[]; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const nextNumber = Math.max(0, ...candidates.map((c) => c.nomor_urut)) + 1;

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteCandidate(deleting.id);
    setBusy(false);
    setDeleting(null);
    if (result.ok) {
      setMessage(`Paslon ${deleting.nomor_urut} dihapus.`);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!editable ? (
        <Notice>Paslon terkunci karena voting (atau uji coba) sedang berjalan atau sudah selesai.</Notice>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      {editable ? (
        <div>
          <Button
            icon="+"
            onClick={() => {
              setError(null);
              setMessage(null);
              setEditing({ mode: "new" });
            }}
          >
            Tambah paslon
          </Button>
        </div>
      ) : null}

      {candidates.length === 0 ? (
        <p className="font-hand text-2xl font-bold text-on-dark">Belum ada paslon.</p>
      ) : (
        <ul className="grid gap-8 md:grid-cols-2">
          {candidates.map((c) => (
            <li
              key={c.id}
              data-testid={`candidate-${c.nomor_urut}`}
              className="fx-tile manila relative flex gap-5 p-5"
            >
              <div className="paper relative h-36 w-28 shrink-0 -rotate-3 p-1.5 pb-4">
                <span aria-hidden className="pin absolute -top-2 left-1/2 z-10 size-4 -translate-x-1/2" />
                <div className="relative size-full overflow-hidden bg-paper">
                {c.foto_url ? <Image src={c.foto_url} alt="" fill unoptimized className="object-cover sepia-[0.3]" /> : null}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-display text-3xl font-black">Paslon {c.nomor_urut}</span>
                <span className="font-type">
                  {c.nama_ketua} &amp; {c.nama_wakil}
                </span>
                <p className="line-clamp-3 whitespace-pre-line font-hand text-lg leading-tight text-ink-soft">{c.visi_misi || "—"}</p>
                {editable ? (
                  <div className="mt-auto flex gap-2 pt-2">
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={() => {
                        setError(null);
                        setMessage(null);
                        setEditing({ mode: "edit", candidate: c });
                      }}
                    >
                      Ubah
                    </Button>
                    <Button size="md" variant="ghost" onClick={() => setDeleting(c)}>
                      Hapus
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => !busy && setEditing(null)} labelledBy="candidate-form-title">
        {editing ? (
          <CandidateForm
            key={editing.mode === "edit" ? editing.candidate.id : "new"}
            initial={editing.mode === "edit" ? editing.candidate : null}
            defaultNumber={nextNumber}
            onCancel={() => setEditing(null)}
            onBusy={setBusy}
            onSaved={(text) => {
              setEditing(null);
              setMessage(text);
              router.refresh();
            }}
          />
        ) : null}
      </Modal>

      <Modal open={deleting !== null} onClose={() => !busy && setDeleting(null)} labelledBy="delete-title">
        {deleting ? (
          <div className="flex flex-col gap-5">
            <h2 id="delete-title" className="font-display text-3xl font-black">
              Hapus Paslon {deleting.nomor_urut}?
            </h2>
            <p className="font-type text-ink">
              {deleting.nama_ketua} &amp; {deleting.nama_wakil} akan dihapus beserta fotonya.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>
                Batal
              </Button>
              <Button variant="danger" disabled={busy} onClick={confirmDelete}>
                {busy ? "Menghapus..." : "Ya, hapus"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function CandidateForm({
  initial,
  defaultNumber,
  onCancel,
  onBusy,
  onSaved,
}: {
  initial: Candidate | null;
  defaultNumber: number;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial?.foto_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function pickFile(selected: File | null) {
    setError(null);
    if (!selected) return;
    if (!PHOTO_TYPES.includes(selected.type)) {
      setError("Foto harus JPG, PNG, atau WEBP.");
      return;
    }
    if (selected.size > MAX_PHOTO_BYTES) {
      setError("Ukuran foto maksimal 2 MB.");
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    onBusy(true);
    setError(null);

    let fotoUrl = initial?.foto_url ?? null;
    let uploadedPath: string | null = null;
    const storage = getBrowserClient().storage.from(PHOTO_BUCKET);

    try {
      if (file) {
        const ext = file.type.split("/")[1].replace("jpeg", "jpg");
        uploadedPath = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await storage.upload(uploadedPath, file, { contentType: file.type });
        if (uploadError) {
          setError("Gagal mengunggah foto. Pastikan status masih draft dan coba lagi.");
          return;
        }
        fotoUrl = storage.getPublicUrl(uploadedPath).data.publicUrl;
      }

      const result = await saveCandidate({
        id: initial?.id,
        nomor_urut: Number(form.get("nomor_urut")),
        nama_ketua: String(form.get("nama_ketua") ?? ""),
        nama_wakil: String(form.get("nama_wakil") ?? ""),
        visi_misi: String(form.get("visi_misi") ?? ""),
        foto_url: fotoUrl,
      });

      if (!result.ok) {
        if (uploadedPath) await storage.remove([uploadedPath]);
        setError(result.error);
        return;
      }
      onSaved(initial ? "Perubahan paslon disimpan." : "Paslon baru ditambahkan.");
    } catch {
      if (uploadedPath) await storage.remove([uploadedPath]);
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSaving(false);
      onBusy(false);
    }
  }

  const field = "paper rounded-sticker border-b-2 border-ink px-3 py-2 font-type text-base shadow-sticker focus:shadow-[0_0_0_3px_var(--color-pink)] focus:outline-none";
  const label = "font-type text-xs uppercase tracking-widest text-ink-soft";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 id="candidate-form-title" className="font-display text-3xl font-black">
        {initial ? `UBAH PASLON ${initial.nomor_urut}` : "TAMBAH PASLON"}
      </h2>

      <div className="flex gap-4">
        <div className="paper relative h-36 w-28 shrink-0 -rotate-2 overflow-hidden border-[6px] border-surface">
          {preview ? <Image src={preview} alt="Pratinjau foto" fill unoptimized className="object-cover" /> : null}
        </div>
        <label className="flex flex-1 flex-col gap-2">
          <span className={label}>Foto (JPG/PNG/WEBP, maks 2 MB)</span>
          <input
            type="file"
            name="foto"
            accept={PHOTO_TYPES.join(",")}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:border-2 file:border-ink file:bg-surface file:px-3 file:py-1.5 file:font-type file:text-xs file:uppercase"
          />
          <span className="font-type text-xs text-ink-soft">Disarankan foto berdua, rasio potret 4:5.</span>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={label}>Nomor urut</span>
        <input
          name="nomor_urut"
          type="number"
          min={1}
          max={99}
          required
          defaultValue={initial?.nomor_urut ?? defaultNumber}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={label}>Nama ketua</span>
        <input name="nama_ketua" required maxLength={80} defaultValue={initial?.nama_ketua} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={label}>Nama wakil</span>
        <input name="nama_wakil" required maxLength={80} defaultValue={initial?.nama_wakil} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={label}>Visi &amp; misi</span>
        <textarea name="visi_misi" rows={4} maxLength={3000} defaultValue={initial?.visi_misi} className={field} />
      </label>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
