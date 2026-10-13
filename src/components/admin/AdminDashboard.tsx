"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { runLifecycle, type LifecycleAction } from "@/app/admin/(panel)/actions";
import { ResultsView } from "@/components/admin/ResultsView";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { Sticker, type StickerColor } from "@/components/ui/Sticker";
import { adminErrorText } from "@/lib/admin-errors";
import { authorizeRealtime, getBrowserClient } from "@/lib/supabase/browser";
import type { Results } from "@/lib/types";

const POLL_MS = 5_000;

type Confirmation = {
  action: LifecycleAction;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
};

const CONFIRMATIONS: Record<LifecycleAction, Confirmation> = {
  start_test: {
    action: "start_test",
    title: "Mulai mode uji coba?",
    body: "Bilik bisa dipakai untuk mencoba. Suara uji ditandai dan TIDAK dihitung di hasil resmi. Paslon terkunci selama uji coba.",
    confirmLabel: "Mulai uji coba",
  },
  end_test: {
    action: "end_test",
    title: "Akhiri uji coba?",
    body: "Semua suara uji akan dibersihkan dan status kembali ke draft. Suara sungguhan tidak terpengaruh.",
    confirmLabel: "Akhiri uji coba",
  },
  open_voting: {
    action: "open_voting",
    title: "Buka pemungutan suara SUNGGUHAN?",
    body: "Setelah dibuka, voting tidak bisa dikembalikan ke draft, suara tidak bisa dihapus, dan paslon tidak bisa diubah. Pastikan uji coba sudah selesai.",
    confirmLabel: "Ya, buka voting",
    danger: true,
  },
  close_voting: {
    action: "close_voting",
    title: "Tutup pemungutan suara?",
    body: "Bilik tidak bisa menerima suara lagi. Langkah ini FINAL dan tidak bisa dibuka kembali.",
    confirmLabel: "Ya, tutup voting",
    danger: true,
  },
};

export function AdminDashboard({ initialResults }: { initialResults: Results }) {
  const [results, setResults] = useState(initialResults);
  const [live, setLive] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const { data, error } = await getBrowserClient().rpc("get_results");
      if (error) throw error;
      setResults(data as Results);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Realtime: every vote bumps results_version; status changes update election.
  // Polling keeps the numbers right even if the Realtime connection drops.
  useEffect(() => {
    const supabase = getBrowserClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    void authorizeRealtime().then((client) => {
      if (cancelled) return;
      channel = client
        .channel("admin-results")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "results_version" }, () => refresh())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "election" }, () => refresh())
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    });

    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  async function confirm() {
    if (!confirming) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await runLifecycle(confirming.action);
      if (result.ok) {
        setNotice(result.message ? { tone: "success", text: result.message } : null);
      } else {
        setNotice({ tone: "error", text: result.error });
      }
    } catch (error) {
      setNotice({ tone: "error", text: adminErrorText((error as Error).message) });
    } finally {
      setBusy(false);
      setConfirming(null);
      await refresh();
    }
  }

  const state = statusInfo(results);

  return (
    <div className="flex flex-col gap-8">
      <section
        className="fx-tile relative flex animate-rise flex-col gap-5 overflow-hidden rounded-card border-[3px] border-ink bg-surface p-5 pl-7 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:pl-9"
      >
        <span aria-hidden className={`absolute inset-y-0 left-0 w-3 border-r-[3px] border-ink ${state.bar}`} />
        <div className="flex items-center gap-5">
          <span
            aria-hidden
            className={`hidden size-16 shrink-0 -rotate-6 place-items-center rounded-card border-[3px] border-ink text-3xl shadow-[3px_3px_0_var(--color-ink)] sm:grid ${state.bar}`}
          >
            {state.icon}
          </span>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">Status</span>
              <Sticker color={state.color}>{state.label}</Sticker>
              <LiveBadge live={live} error={fetchError} at={results.generated_at} />
            </div>
            <p className="font-hand text-xl text-ink-soft">{state.hint}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {results.status === "draft" ? (
            <>
              <Button variant="secondary" onClick={() => setConfirming(CONFIRMATIONS.start_test)}>
                Mulai uji coba
              </Button>
              <Button onClick={() => setConfirming(CONFIRMATIONS.open_voting)}>Buka voting</Button>
            </>
          ) : null}
          {results.status === "open" && results.test_mode ? (
            <Button variant="secondary" onClick={() => setConfirming(CONFIRMATIONS.end_test)}>
              Akhiri uji coba
            </Button>
          ) : null}
          {results.status === "open" && !results.test_mode ? (
            <Button variant="danger" onClick={() => setConfirming(CONFIRMATIONS.close_voting)}>
              Tutup voting
            </Button>
          ) : null}
        </div>
      </section>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      {results.test_mode ? (
        <Notice>Angka di bawah adalah suara UJI COBA dan tidak masuk hasil resmi.</Notice>
      ) : null}

      <ResultsView results={results} />

      <section aria-labelledby="export-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="export-title" className="font-display text-2xl">
            EKSPOR HASIL
          </h2>
          <span className="font-hand text-lg text-ink-soft">
            {results.status === "closed" ? "Hasil akhir." : "Sebelum voting ditutup, file ditandai SEMENTARA."}
          </span>
        </div>
        <div className="fx-grid grid gap-5 sm:grid-cols-2">
          <ExportCard href="/admin/export/csv" label="CSV (Excel)" body="Untuk diolah di Excel atau Google Sheets." accent="var(--color-mint)" />
          <ExportCard href="/admin/export/pdf" label="PDF" body="Siap cetak, ada kolom tanda tangan saksi." accent="var(--color-yellow)" />
        </div>
      </section>

      <Modal open={confirming !== null} onClose={() => !busy && setConfirming(null)} labelledBy="lifecycle-title">
        {confirming ? (
          <div className="flex flex-col gap-5">
            <Sticker color={confirming.danger ? "pink" : "yellow"} rotate={-2}>
              {confirming.danger ? "Langkah final" : "Konfirmasi"}
            </Sticker>
            <h2 id="lifecycle-title" className="text-2xl font-bold leading-snug sm:text-3xl">
              {confirming.title}
            </h2>
            <p className="text-ink-soft">{confirming.body}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" disabled={busy} onClick={() => setConfirming(null)}>
                Batal
              </Button>
              <Button variant={confirming.danger ? "danger" : "primary"} disabled={busy} onClick={confirm}>
                {busy ? "Memproses..." : confirming.confirmLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function statusInfo(results: Results): { label: string; color: StickerColor; hint: string; bar: string; icon: string } {
  if (results.status === "open" && results.test_mode) {
    return {
      label: "Uji coba",
      color: "pink",
      hint: "Bilik menerima suara uji. Akhiri uji coba sebelum voting sungguhan.",
      bar: "bg-pink text-white",
      icon: "⚑",
    };
  }
  if (results.status === "open") {
    return { label: "Dibuka", color: "green", hint: "Pemungutan suara sedang berlangsung.", bar: "bg-green text-white", icon: "●" };
  }
  if (results.status === "closed") {
    return {
      label: "Ditutup",
      color: "blue",
      hint: "Pemungutan suara selesai. Hasil di bawah adalah hasil akhir.",
      bar: "bg-blue text-white",
      icon: "■",
    };
  }
  return { label: "Draft", color: "yellow", hint: "Belum dibuka. Paslon masih bisa diubah.", bar: "bg-yellow", icon: "✎" };
}

function ExportCard({ href, label, body, accent }: { href: string; label: string; body: string; accent: string }) {
  return (
    <a
      href={href}
      download
      style={{ "--accent": accent, "--lift": "-6px", "--tilt": "-0.5deg" } as CSSProperties}
      className="fx-card flex items-center gap-4 rounded-card border-[3px] border-ink bg-surface p-4 shadow-card"
    >
      <span className="fx-wiggle grid size-14 shrink-0 place-items-center rounded-card border-[3px] border-ink bg-[var(--accent)] text-2xl shadow-[3px_3px_0_var(--color-ink)]">
        ↓
      </span>
      <span className="flex flex-1 flex-col">
        <span className="font-mono text-sm font-bold uppercase tracking-widest">{label}</span>
        <span className="text-sm text-ink-soft">{body}</span>
      </span>
      <span aria-hidden className="fx-arrow text-xl">
        →
      </span>
    </a>
  );
}

function LiveBadge({ live, error, at }: { live: boolean; error: boolean; at: string }) {
  const time = new Date(at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  if (error) {
    return (
      <span className="font-mono text-xs font-bold uppercase tracking-widest text-danger">
        ● Koneksi terputus · data {time}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">
      <span aria-hidden className={`size-2 rounded-full ${live ? "animate-pulse bg-green" : "bg-ink-soft"}`} />
      {live ? "Live" : "Polling"} · {time}
    </span>
  );
}
