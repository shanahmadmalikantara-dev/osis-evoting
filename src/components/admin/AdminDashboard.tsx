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
      <section className="fx-tile paper-ruled relative flex animate-rise flex-col gap-5 py-6 pl-14 pr-6 sm:flex-row sm:items-center sm:justify-between">
        <span aria-hidden className="pin absolute -top-2 left-1/3 size-5" />
        <div className="flex items-center gap-6">
          <span
            className={`rubber-stamp hidden -rotate-6 px-4 py-2 text-2xl sm:inline-block ${state.stamp}`}
            aria-hidden
          >
            {state.icon}
          </span>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-type text-xs uppercase tracking-widest text-ink-soft">Status</span>
              <Sticker color={state.color}>{state.label}</Sticker>
              <LiveBadge live={live} error={fetchError} at={results.generated_at} />
            </div>
            <p className="font-hand text-2xl font-bold text-ink">{state.hint}</p>
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
          <h2 id="export-title" className="font-display text-3xl font-black text-on-dark [text-shadow:0_2px_4px_rgb(0_0_0/0.5)]">
            Ekspor hasil
          </h2>
          <span className="font-hand text-2xl font-bold text-on-dark/90">
            {results.status === "closed" ? "Hasil akhir." : "Sebelum voting ditutup, file ditandai SEMENTARA."}
          </span>
        </div>
        <div className="fx-grid grid gap-6 sm:grid-cols-2">
          <ExportCard href="/admin/export/csv" label="CSV (Excel)" body="Untuk diolah di Excel atau Google Sheets." rot="-1deg" />
          <ExportCard href="/admin/export/pdf" label="PDF" body="Siap cetak, ada kolom tanda tangan saksi." rot="0.8deg" />
        </div>
      </section>

      <Modal open={confirming !== null} onClose={() => !busy && setConfirming(null)} labelledBy="lifecycle-title">
        {confirming ? (
          <div className="flex flex-col gap-5">
            <span className="rubber-stamp w-fit -rotate-3 px-2 py-0.5 text-xs">
              {confirming.danger ? "Langkah final" : "Konfirmasi"}
            </span>
            <h2 id="lifecycle-title" className="font-display text-3xl font-black leading-tight sm:text-4xl">
              {confirming.title}
            </h2>
            <p className="font-type text-ink">{confirming.body}</p>
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

function statusInfo(results: Results): { label: string; color: StickerColor; hint: string; stamp: string; icon: string } {
  if (results.status === "open" && results.test_mode) {
    return {
      label: "Uji coba",
      color: "pink",
      hint: "Bilik menerima suara uji. Akhiri uji coba sebelum voting sungguhan.",
      stamp: "",
      icon: "Uji",
    };
  }
  if (results.status === "open") {
    return { label: "Dibuka", color: "green", hint: "Pemungutan suara sedang berlangsung.", stamp: "[--stamp:var(--color-success)]", icon: "Buka" };
  }
  if (results.status === "closed") {
    return {
      label: "Ditutup",
      color: "blue",
      hint: "Pemungutan suara selesai. Hasil di bawah adalah hasil akhir.",
      stamp: "[--stamp:var(--color-blue)]",
      icon: "Final",
    };
  }
  return { label: "Draft", color: "yellow", hint: "Belum dibuka. Paslon masih bisa diubah.", stamp: "[--stamp:var(--color-ink-soft)]", icon: "Draf" };
}

// Air-mail envelope that downloads the export.
function ExportCard({ href, label, body, rot }: { href: string; label: string; body: string; rot: string }) {
  return (
    <a href={href} download style={{ "--rot": rot, "--lift": "-8px" } as CSSProperties} className="fx-card group block">
      <div className="fx-body airmail shadow-card">
        <div className="paper flex items-center gap-4 p-4 shadow-none">
          <span className="fx-stamp rubber-stamp grid size-14 shrink-0 place-items-center rounded-full text-2xl">↓</span>
          <span className="flex flex-1 flex-col">
            <span className="font-display text-2xl font-black">{label}</span>
            <span className="font-type text-sm text-ink-soft">{body}</span>
          </span>
          <span aria-hidden className="fx-arrow text-2xl">
            →
          </span>
        </div>
      </div>
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
