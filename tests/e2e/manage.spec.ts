import { expect, test, type Page } from "@playwright/test";
import { E2E_USERS, resetCandidates, resetElection, withDb } from "./fixtures";
import { alertBox, login } from "./helpers";

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function asAdmin(page: Page) {
  await login(page, "/admin/login", E2E_USERS.admin.username);
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("candidate management, export, audit", () => {
  test.beforeEach(async () => {
    await resetElection({ status: "draft" });
    await resetCandidates();
  });

  test("add a candidate with a photo, edit it, then delete it", async ({ page }) => {
    await asAdmin(page);
    await page.goto("/admin/paslon");
    await page.getByRole("button", { name: "Tambah paslon" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Nomor urut")).toHaveValue("5");
    await dialog.getByLabel("Nama ketua").fill("Budi Santoso");
    await dialog.getByLabel("Nama wakil").fill("Citra Lestari");
    await dialog.getByLabel("Visi & misi").fill("Visi: maju bersama.");
    await dialog.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await dialog.getByRole("button", { name: "Simpan" }).click();

    const card = page.getByTestId("candidate-5");
    await expect(card).toContainText("Budi Santoso & Citra Lestari");
    const src = await card.locator("img").getAttribute("src");
    expect(src).toContain("/storage/v1/object/public/candidate-photos/");
    expect((await page.request.get(src!)).status()).toBe(200);

    await card.getByRole("button", { name: "Ubah" }).click();
    await dialog.getByLabel("Nama wakil").fill("Citra Dewi");
    await dialog.getByRole("button", { name: "Simpan" }).click();
    await expect(card).toContainText("Budi Santoso & Citra Dewi");

    await card.getByRole("button", { name: "Hapus" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ya, hapus" }).click();
    await expect(page.getByTestId("candidate-5")).toHaveCount(0);
    expect((await page.request.get(src!)).status()).not.toBe(200);

    await page.goto("/admin/audit");
    await expect(page.getByRole("cell", { name: "Menambah paslon 5: Budi Santoso & Citra Lestari" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Mengubah paslon 5: Budi Santoso & Citra Dewi" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: /^Menghapus paslon 5/ }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Login admin" }).first()).toBeVisible();
  });

  test("duplicate ballot number is rejected", async ({ page }) => {
    await asAdmin(page);
    await page.goto("/admin/paslon");
    await page.getByRole("button", { name: "Tambah paslon" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nomor urut").fill("2");
    await dialog.getByLabel("Nama ketua").fill("A");
    await dialog.getByLabel("Nama wakil").fill("B");
    await dialog.getByRole("button", { name: "Simpan" }).click();
    await expect(alertBox(page)).toContainText("sudah dipakai");
  });

  test("booth shows five cards after a fifth candidate is added", async ({ page, browser }) => {
    await withDb((db) =>
      db.query(
        "insert into public.candidates (nomor_urut, nama_ketua, nama_wakil, foto_url) values (5, 'Eko', 'Fitri', '/dummy/paslon-1.svg')",
      ),
    );
    await resetElection({ status: "open" });
    const booth = await (await browser.newContext()).newPage();
    await login(booth, "/bilik/login", E2E_USERS.bilik.username);
    await expect(booth.getByRole("button", { name: /^Paslon \d:/ })).toHaveCount(5);
    void page;
  });

  test("candidates are locked once voting is open", async ({ page }) => {
    await resetElection({ status: "open" });
    await asAdmin(page);
    await page.goto("/admin/paslon");
    await expect(page.getByText("Paslon terkunci")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tambah paslon" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ubah" })).toHaveCount(0);
  });

  test("CSV and PDF export work for admins only and are audited", async ({ page, browser }) => {
    await asAdmin(page);
    const csv = await page.request.get("/admin/export/csv");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-disposition"]).toMatch(/hasil-pemilu-osis-.*-SEMENTARA\.csv/);
    const body = await csv.text();
    expect(body).toContain("Nomor urut;Ketua;Wakil;Suara;Persentase");
    expect(body).toContain("1;Rafi Pratama;Nadia Salsabila;0;0,0%");

    const pdf = await page.request.get("/admin/export/pdf");
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

    await page.goto("/admin/audit");
    await expect(page.getByRole("cell", { name: "Mengekspor hasil (CSV)" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Mengekspor hasil (PDF)" }).first()).toBeVisible();

    const booth = await (await browser.newContext()).newPage();
    await login(booth, "/bilik/login", E2E_USERS.bilik.username);
    await expect(booth).toHaveURL(/\/bilik$/);
    expect((await booth.request.get("/admin/export/csv")).status()).toBe(403);
  });
});
