import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_USERS, resetElection } from "./fixtures";
import { login } from "./helpers";

async function adminPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await login(page, "/admin/login", E2E_USERS.admin.username);
  await expect(page).toHaveURL(/\/admin$/);
  return page;
}

async function boothPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await login(page, "/bilik/login", E2E_USERS.bilik.username);
  await expect(page).toHaveURL(/\/bilik$/);
  return page;
}

async function vote(booth: Page, number: number) {
  await booth.getByRole("button", { name: new RegExp(`^Paslon ${number}:`) }).click();
  await booth.getByRole("button", { name: "Ya, kirim" }).click();
  await expect(booth.getByRole("heading", { name: "TERIMA KASIH" })).toBeVisible();
  await expect(booth.getByRole("heading", { name: "PILIH PASLON" })).toBeVisible({ timeout: 8_000 });
}

async function lifecycle(admin: Page, button: string, confirm: string) {
  await admin.getByRole("button", { name: button, exact: true }).click();
  await admin.getByRole("dialog").getByRole("button", { name: confirm }).click();
  await expect(admin.getByRole("dialog")).toBeHidden();
}

const total = (admin: Page) => admin.getByTestId("total-votes");

test.describe("admin dashboard", () => {
  test.beforeEach(async () => {
    await resetElection({ status: "draft" });
  });

  test("full flow: trial run, open, live counts, close", async ({ browser }) => {
    test.setTimeout(120_000);
    const admin = await adminPage(browser);
    await expect(admin.getByText("Draft", { exact: true })).toBeVisible();
    await expect(total(admin)).toHaveText("0");

    // Trial run: votes appear live, then are purged.
    await lifecycle(admin, "Mulai uji coba", "Mulai uji coba");
    await expect(admin.getByText("Uji coba", { exact: true })).toBeVisible();
    const booth = await boothPage(browser);
    await expect(booth.getByText(/Mode uji coba/i)).toBeVisible();
    await vote(booth, 2);
    await expect(total(admin)).toHaveText("1", { timeout: 6_000 });

    await lifecycle(admin, "Akhiri uji coba", "Akhiri uji coba");
    await expect(admin.getByText("1 suara uji dibersihkan")).toBeVisible();
    await expect(total(admin)).toHaveText("0");
    await expect(booth.getByRole("heading", { name: "BELUM DIBUKA" })).toBeVisible({ timeout: 12_000 });

    // Real voting.
    await lifecycle(admin, "Buka voting", "Ya, buka voting");
    await expect(admin.getByText("Dibuka", { exact: true })).toBeVisible();
    await expect(booth.getByRole("heading", { name: "PILIH PASLON" })).toBeVisible({ timeout: 12_000 });

    for (const n of [1, 1, 3, 1]) await vote(booth, n);
    await expect(total(admin)).toHaveText("4", { timeout: 6_000 });
    await expect(admin.getByTestId("result-1").getByTestId("votes")).toHaveText("3");
    await expect(admin.getByTestId("result-1").getByTestId("percent")).toHaveText("75,0%");
    await expect(admin.getByTestId("result-3").getByTestId("percent")).toHaveText("25,0%");
    await expect(admin.getByTestId("result-2").getByTestId("votes")).toHaveText("0");
    await expect(admin.getByTestId("booth-e2e-bilik")).toContainText("4");

    // No way back to draft once real voting is open.
    await expect(admin.getByRole("button", { name: "Mulai uji coba" })).toHaveCount(0);

    await lifecycle(admin, "Tutup voting", "Ya, tutup voting");
    await expect(admin.getByText("Ditutup", { exact: true })).toBeVisible();
    await expect(booth.getByRole("heading", { name: "SUDAH DITUTUP" })).toBeVisible({ timeout: 12_000 });
    await expect(admin.getByRole("button", { name: /buka voting|tutup voting/i })).toHaveCount(0);
    await expect(total(admin)).toHaveText("4");

    // After closing, the admin can wipe everything, but only with the typed phrase.
    await admin.getByRole("button", { name: "Hapus semua suara" }).click();
    const dialog = admin.getByRole("dialog");
    const wipe = dialog.getByRole("button", { name: "Hapus permanen" });
    await expect(wipe).toBeDisabled();
    await dialog.getByLabel("Ketik konfirmasi").fill("hapus");
    await expect(wipe).toBeDisabled();
    await dialog.getByLabel("Ketik konfirmasi").fill("HAPUS SEMUA SUARA");
    await wipe.click();
    await expect(dialog).toBeHidden();
    await expect(admin.getByText("4 suara dihapus. Status kembali ke draft.")).toBeVisible();
    await expect(admin.getByText("Draft", { exact: true })).toBeVisible();
    await expect(total(admin)).toHaveText("0");
    await expect(admin.getByRole("button", { name: "Hapus semua suara" })).toHaveCount(0);
    await expect(booth.getByRole("heading", { name: "BELUM DIBUKA" })).toBeVisible({ timeout: 12_000 });
  });

  test("the wipe button only exists after voting is closed", async ({ browser }) => {
    const admin = await adminPage(browser);
    await expect(admin.getByRole("button", { name: "Hapus semua suara" })).toHaveCount(0);
    await resetElection({ status: "open" });
    await admin.reload();
    await expect(admin.getByRole("button", { name: "Hapus semua suara" })).toHaveCount(0);
  });

  test("cancel in the confirm dialog changes nothing", async ({ browser }) => {
    const admin = await adminPage(browser);
    await admin.getByRole("button", { name: "Buka voting", exact: true }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Batal" }).click();
    await expect(admin.getByText("Draft", { exact: true })).toBeVisible();
  });
});
