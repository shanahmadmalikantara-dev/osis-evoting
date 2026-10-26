"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActionResult } from "@/app/admin/(panel)/actions";
import { cancelVote, clearVoters, deleteVoter, importVoters } from "@/app/admin/(panel)/pemilih/actions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { accentStyle } from "@/lib/accent";
import { adminErrorText } from "@/lib/admin-errors";
import { formatDateTime } from "@/lib/format";
import { KELOMPOK, kelompokLabel, type KelompokKey } from "@/lib/kelompok";
import { parseRoster } from "@/lib/roster-parse";
import { authorizeRealtime, getBrowserClient } from "@/lib/supabase/browser";
import type { ElectionStatus, ListedVoter } from "@/lib/types";

const POLL_MS = 5_000;

type Pending = {
  title: string;
  body: string;
  confirmLabel: string;
  run: () => Promise<ActionResult>;
};

const FIELD =
  "rounded-sticker border-2 border-ink/40 bg-surface px-3 py-2 font-type text-base outline-none focus:border-pink";

// Roster management: who may vote, who already voted and for whom (owner decision), cancel a
// vote so the person can vote again, and add names by pasting from Excel.
export function VoterManager({ initialVoters, status }: { initialVoters: ListedVoter[]; status: ElectionStatus }) {
  const [voters, setVoters] = useState(initialVoters);
  const [query, setQuery] = useState("");
  const [kelompok, setKelompok] = useState<"" | KelompokKey>("");
  const [filter, setFilter] = useState<"semua" | "sudah" | "belum">("semua");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const { data, error } = await getBrowserClient().rpc("list_voters");
      if (!error) setVoters(data as ListedVoter[]);
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Same live mechanism as the dashboard: every vote or cancellation bumps results_version.
  useEffect(() => {
    const supabase = getBrowserClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    void authorizeRealtime().then((client) => {
      if (cancelled) return;
      channel = client
        .channel("admin-voters")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "results_version" }, () => refresh())
        .subscribe();
    });
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  const voted = voters.filter((v) => v.voted_at).length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return voters
      .filter((v) => !kelompok || v.kelompok === kelompok)
      .filter((v) => filter === "semua" || (filter === "sudah" ? v.voted_at : !v.voted_at))
      .filter((v) => !q || v.nama.toLowerCase().includes(q) || v.kelas.toLowerCase().includes(q));
  }, [voters, query, kelompok, filter]);

  async function perform(run: () => Promise<ActionResult>) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await run();
      setNotice(result.ok ? { tone: "success", text: result.message ?? "Selesai." } : { tone: "error", text: result.error });
      return result.ok;
    } catch (error) {
      setNotice({ tone: "error", text: adminErrorText((error as Error).message) });
      return false;
    } finally {
      setBusy(false);
      setPending(null);
      await refresh();
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <Count label="Terdaftar" value={voters.length} rot="-1deg" />
        <Count label="Sudah memilih" value={voted} rot="0.8deg" testId="count-voted" />
        <Count label="Belum memilih" value={voters.length - voted} rot="-0.5deg" />
      </section>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <section aria-labelledby="list-title" className="paper relative flex flex-col gap-4 p-4 sm:p-6">
        <span aria-hidden className="pin absolute -top-2 left-10 size-5" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="list-title" className="font-display text-3xl font-black">
            Daftar pemilih
          </h2>
          <p className="font-type text-xs uppercase tracking-widest text-ink-soft">
            Diperbarui otomatis · {shown.length} dari {voters.length} nama
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[2fr_1.4fr_1fr]">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau kelas..."
            aria-label="Cari nama atau kelas"
            className={FIELD}
          />
          <select value={kelompok} onChange={(e) => setKelompok(e.target.value as "" | KelompokKey)} aria-label="Perwakilan" className={FIELD}>
            <option value="">Semua perwakilan</option>
            {KELOMPOK.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Status memilih" className={FIELD}>
            <option value="semua">Semua</option>
            <option value="sudah">Sudah memilih</option>
            <option value="belum">Belum memilih</option>
          </select>
        </div>

        {shown.length === 0 ? (
          <p className="py-6 text-center font-type text-ink-soft">Tidak ada nama yang cocok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-dashed divide-paper-line">
            {shown.map((v) => (
              <li key={v.id} data-testid="voter-row" className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="font-type text-lg leading-tight">{v.nama}</span>
                  <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                    {v.kelas} · {kelompokLabel(v.kelompok)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {v.voted_at ? (
                    <span className="flex items-center gap-2" style={v.nomor_urut ? accentStyle(v.nomor_urut) : undefined}>
                      <span className="rubber-stamp grid size-9 place-items-center rounded-full font-display text-base font-black tracking-normal">
                        {v.nomor_urut}
                      </span>
                      <span className="flex flex-col font-type text-xs leading-tight">
                        <span>Memilih paslon {v.nomor_urut}</span>
                        <span className="text-ink-soft">{formatDateTime(v.voted_at)}</span>
                      </span>
                    </span>
                  ) : (
                    <span className="font-type text-sm text-ink-soft">Belum memilih</span>
                  )}
                  {v.voted_at ? (
                    <Button
                      size="md"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        setPending({
                          title: `Batalkan suara ${v.nama}?`,
                          body: `Suara ${v.nama} (${v.kelas}) dihapus dari hitungan dan namanya bisa dipilih lagi untuk memilih ulang. Tercatat di audit log.`,
                          confirmLabel: "Ya, batalkan",
                          run: () => cancelVote(v.id),
                        })
                      }
                    >
                      Batalkan suara
                    </Button>
                  ) : status !== "closed" ? (
                    <Button
                      size="md"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        setPending({
                          title: `Hapus ${v.nama} dari daftar?`,
                          body: `${v.nama} (${v.kelas}) tidak akan muncul lagi di halaman pemilih.`,
                          confirmLabel: "Ya, hapus",
                          run: () => deleteVoter(v.id),
                        })
                      }
                    >
                      Hapus
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {status !== "closed" ? <ImportSection busy={busy} onImport={(rows) => perform(() => importVoters(rows))} /> : null}

      {status === "draft" && voters.length > 0 ? (
        <section className="paper flex flex-col gap-4 border-2 border-dashed border-pink p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-2xl font-black">Kosongkan daftar</h2>
            <p className="font-type text-sm text-ink">
              Hapus semua nama, misalnya untuk mengganti data contoh dengan data asli. Hanya bisa saat status draft.
            </p>
          </div>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              setPending({
                title: "Kosongkan daftar pemilih?",
                body: `Semua ${voters.length} nama akan dihapus. Setelah itu tempel daftar yang baru.`,
                confirmLabel: "Ya, kosongkan",
                run: clearVoters,
              })
            }
          >
            Kosongkan daftar
          </Button>
        </section>
      ) : null}

      <Modal open={pending !== null} onClose={() => !busy && setPending(null)} labelledBy="voter-confirm-title">
        {pending ? (
          <div className="flex flex-col gap-5">
            <span className="rubber-stamp w-fit -rotate-3 px-2 py-0.5 text-xs">Konfirmasi</span>
            <h2 id="voter-confirm-title" className="font-display text-3xl font-black leading-tight">
              {pending.title}
            </h2>
            <p className="font-type text-ink">{pending.body}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" disabled={busy} onClick={() => setPending(null)}>
                Batal
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => perform(pending.run)}>
                {busy ? "Memproses..." : pending.confirmLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Count({ label, value, rot, testId }: { label: string; value: number; rot: string; testId?: string }) {
  return (
    <div style={{ rotate: rot }} className="paper-ruled relative flex animate-drop flex-col gap-1 py-4 pl-14 pr-5">
      <span aria-hidden className="pin absolute -top-2 left-1/2 size-5 -translate-x-1/2" />
      <span className="font-type text-xs uppercase tracking-widest text-pink">{label}</span>
      <span data-testid={testId} className="font-display text-5xl font-black leading-none tabular-nums">
        {value.toLocaleString("id-ID")}
      </span>
    </div>
  );
}

function ImportSection({
  busy,
  onImport,
}: {
  busy: boolean;
  onImport: (rows: { nama: string; kelas: string; kelompok: string }[]) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [fallback, setFallback] = useState<"" | KelompokKey>("");
  const parsed = useMemo(() => parseRoster(text, fallback || null), [text, fallback]);
  const kelasCount = new Set(parsed.rows.map((r) => r.kelas)).size;

  return (
    <section aria-labelledby="import-title" className="manila relative flex flex-col gap-4 rounded-modal p-4 shadow-card-lift sm:p-6">
      <span aria-hidden className="tape absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 rotate-2" />
      <div className="flex flex-col gap-1">
        <h2 id="import-title" className="font-display text-3xl font-black">
          Tambah nama
        </h2>
        <p className="font-type text-sm text-ink">
          Salin dari Excel 3 kolom: <strong>Nama</strong>, <strong>Kelas</strong>, <strong>Perwakilan</strong>, lalu tempel di
          bawah. Kalau semua nama dari perwakilan yang sama, cukup 2 kolom (Nama, Kelas) dan pilih perwakilannya. Nama yang sudah
          ada dengan kelas yang sama otomatis dilewati.
        </p>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-type text-xs uppercase tracking-widest text-ink-soft">Perwakilan untuk baris tanpa kolom perwakilan</span>
        <select value={fallback} onChange={(e) => setFallback(e.target.value as "" | KelompokKey)} className={FIELD}>
          <option value="">(ambil dari kolom ke-3)</option>
          {KELOMPOK.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-type text-xs uppercase tracking-widest text-ink-soft">Tempel di sini</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          spellCheck={false}
          placeholder={"Andi Saputra\tX-1\tPerwakilan Kelas\nGita Permata\tX-3\tKetua Eskul"}
          className={`${FIELD} font-mono text-sm`}
        />
      </label>
      {text.trim() ? (
        <div className="flex flex-col gap-2 font-type text-sm">
          <p>
            <strong>{parsed.rows.length}</strong> nama siap ditambahkan
            {parsed.rows.length > 0 ? ` (${kelasCount} kelas)` : ""}.
            {parsed.problems.length > 0 ? ` ${parsed.problems.length} baris bermasalah:` : ""}
          </p>
          {parsed.problems.length > 0 ? (
            <ul className="list-disc pl-5 text-danger">
              {parsed.problems.slice(0, 8).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {parsed.problems.length > 8 ? <li>...dan {parsed.problems.length - 8} lagi</li> : null}
            </ul>
          ) : null}
          {parsed.rows.length > 0 ? (
            <ul className="text-ink-soft">
              {parsed.rows.slice(0, 3).map((r, i) => (
                <li key={i}>
                  {r.nama} · {r.kelas} · {kelompokLabel(r.kelompok)}
                </li>
              ))}
              {parsed.rows.length > 3 ? <li>...</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
      <Button
        className="w-fit"
        disabled={busy || parsed.rows.length === 0 || parsed.problems.length > 0}
        onClick={async () => {
          if (await onImport(parsed.rows)) setText("");
        }}
      >
        {busy ? "Menyimpan..." : `Tambahkan ${parsed.rows.length} nama`}
      </Button>
      {parsed.problems.length > 0 ? (
        <p className="font-type text-xs text-ink-soft">Perbaiki baris yang bermasalah dulu, lalu tempel ulang.</p>
      ) : null}
    </section>
  );
}
