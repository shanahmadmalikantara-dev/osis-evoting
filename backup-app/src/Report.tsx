import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { api, errorText, type Report as ReportData } from "./store";

const SIGNERS = ["Petugas bilik", "Saksi 1", "Saksi 2", "Pembina OSIS"];

// Official tally sheet for this backup booth. "Cetak / Simpan PDF" opens the Windows print
// dialog; choose "Microsoft Print to PDF" to get a PDF file.
export function Report({ pin, onBack }: { pin: string; onBack: () => void }) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printedAt] = useState(() => new Date());

  useEffect(() => {
    api.report(pin).then(setReport, (e) => setError(errorText(e)));
  }, [pin]);

  return (
    <div className="flex flex-1 flex-col items-center gap-5 py-4">
      <div className="no-print flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Kembali
        </Button>
        <Button onClick={() => window.print()} disabled={!report}>
          Cetak / Simpan PDF
        </Button>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {report ? (
        <article className="print-sheet paper w-full max-w-3xl px-8 py-10 text-ink sm:px-12">
          <header className="border-b-2 border-ink pb-4 text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.25em]">Pemilihan Ketua &amp; Wakil Ketua OSIS · MAN 4 Jakarta</p>
            <h1 className="mt-2 font-display text-3xl font-black uppercase leading-tight">Berita acara penghitungan suara</h1>
            <p className="font-display text-xl font-bold">Bilik cadangan no. {report.bilik}</p>
          </header>

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 font-type text-sm">
            <dt className="text-ink-soft">Dicetak</dt>
            <dd>{printedAt.toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}</dd>
            <dt className="text-ink-soft">Status bilik cadangan</dt>
            <dd>{report.status === "closed" ? "Ditutup (hasil akhir)" : report.status === "open" ? "Masih dibuka (SEMENTARA)" : "Belum dibuka"}</dd>
          </dl>

          <table className="mt-6 w-full border-collapse font-type">
            <thead>
              <tr className="border-b-2 border-ink text-left text-sm uppercase tracking-widest">
                <th className="py-2 pr-3">No.</th>
                <th className="py-2 pr-3">Pasangan calon</th>
                <th className="py-2 text-right">Suara</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.nomor_urut} className="border-b border-ink/30" data-testid={`report-${r.nomor_urut}`}>
                  <td className="py-3 pr-3 font-display text-2xl font-black">{r.nomor_urut}</td>
                  <td className="py-3 pr-3">
                    {r.nama_ketua} &amp; {r.nama_wakil}
                  </td>
                  <td className="py-3 text-right font-display text-2xl font-black tabular-nums">{r.votes}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td className="py-3 pr-3 text-right font-bold uppercase tracking-widest">Total suara</td>
                <td className="py-3 text-right font-display text-3xl font-black tabular-nums" data-testid="report-total">
                  {report.total}
                </td>
              </tr>
            </tfoot>
          </table>
          {report.unknown > 0 ? (
            <p className="mt-2 font-type text-sm text-pink">Perhatian: {report.unknown} suara untuk paslon yang sudah tidak ada di daftar.</p>
          ) : null}

          <p className="mt-6 font-type text-sm leading-relaxed">
            Angka di atas adalah suara yang masuk lewat aplikasi cadangan di laptop ini selama website tidak bisa dipakai. Angka ini
            ditambahkan secara manual ke rekap akhir, bersama hasil dari website.
          </p>
          <p className="mt-2 break-all font-mono text-[11px] text-ink-soft">Sidik file data suara (SHA-256): {report.file_hash}</p>

          <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-12 sm:grid-cols-4">
            {SIGNERS.map((role) => (
              <div key={role} className="flex flex-col items-center gap-1 text-center font-type text-sm">
                <span>{role}</span>
                <span className="mt-14 w-full border-b border-ink" />
                <span className="text-xs text-ink-soft">nama &amp; tanda tangan</span>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </div>
  );
}
