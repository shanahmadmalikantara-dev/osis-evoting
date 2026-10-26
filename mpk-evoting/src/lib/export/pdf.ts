import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDateTime, percent } from "@/lib/format";
import type { Results } from "@/lib/types";
import { ELECTION_TITLE, statusLabel } from "./labels";

const INK = rgb(0.106, 0.106, 0.106);
const SOFT = rgb(0.33, 0.33, 0.31);
const BAR = rgb(0.184, 0.31, 0.941);
const LINE = rgb(0.85, 0.84, 0.81);

// Standard PDF fonts only cover WinAnsi; replace anything else so export never fails.
function safe(text: string): string {
  return text.replace(/[^\x20-\x7E -ÿ]/g, "?");
}

export async function resultsToPdf(results: Results, exportedAt: Date): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Hasil Pemilu MPK MAN 4 Jakarta");
  const page = doc.addPage([595.28, 841.89]); // A4
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const left = 50;
  const right = 545;
  let y = 790;

  const text = (value: string, x: number, size: number, font: PDFFont = regular, color = INK) =>
    page.drawText(safe(value), { x, y, size, font, color });
  const textRight = (value: string, x: number, size: number, font: PDFFont = regular) =>
    page.drawText(safe(value), { x: x - font.widthOfTextAtSize(safe(value), size), y, size, font, color: INK });

  text("HASIL PEMUNGUTAN SUARA", left, 20, bold);
  y -= 22;
  text(ELECTION_TITLE, left, 12, regular, SOFT);
  y -= 28;

  for (const [label, value] of [
    ["Status", statusLabel(results)],
    ["Dibuka", formatDateTime(results.opened_at)],
    ["Ditutup", formatDateTime(results.closed_at)],
    ["Diekspor", formatDateTime(exportedAt.toISOString())],
    ["Total suara", results.total.toLocaleString("id-ID")],
  ]) {
    text(label, left, 10, bold);
    text(value, left + 90, 10);
    y -= 16;
  }

  y -= 14;
  hr(page, left, right, y + 8);
  text("PEROLEHAN SUARA PER PASLON", left, 12, bold);
  y -= 24;

  const max = Math.max(1, ...results.candidates.map((c) => c.votes));
  for (const c of results.candidates) {
    text(`${c.nomor_urut}.  ${c.nama_ketua} & ${c.nama_wakil}`, left, 11, bold);
    textRight(`${c.votes.toLocaleString("id-ID")} suara  (${percent(c.votes, results.total)})`, right, 11);
    y -= 14;
    page.drawRectangle({ x: left, y, width: right - left, height: 10, color: rgb(0.96, 0.95, 0.93) });
    if (c.votes > 0) page.drawRectangle({ x: left, y, width: ((right - left) * c.votes) / max, height: 10, color: BAR });
    y -= 22;
  }

  y -= 6;
  hr(page, left, right, y + 8);
  text("KEHADIRAN PER KELOMPOK", left, 12, bold);
  y -= 20;
  for (const g of results.groups) {
    text(g.label, left, 10);
    textRight(`${g.voted.toLocaleString("id-ID")} / ${g.total.toLocaleString("id-ID")}`, left + 300, 10, bold);
    y -= 15;
  }

  // Signature boxes for the advisors / witnesses.
  y = Math.min(y - 30, 190);
  text("Disahkan oleh:", left, 10, bold);
  y -= 90;
  const boxWidth = (right - left - 30) / 3;
  for (let i = 0; i < 3; i++) {
    const x = left + i * (boxWidth + 15);
    page.drawLine({ start: { x, y }, end: { x: x + boxWidth, y }, thickness: 1, color: INK });
    page.drawText("Nama & tanda tangan", { x, y: y - 14, size: 8, font: regular, color: SOFT });
  }

  page.drawText(safe(`Dibuat otomatis oleh aplikasi e-voting · ${formatDateTime(exportedAt.toISOString())}`), {
    x: left,
    y: 30,
    size: 8,
    font: regular,
    color: SOFT,
  });

  return doc.save();
}

function hr(page: PDFPage, left: number, right: number, y: number) {
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: LINE });
}
