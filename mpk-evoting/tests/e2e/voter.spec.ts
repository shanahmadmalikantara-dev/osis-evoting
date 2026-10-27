import { expect, test } from "@playwright/test";
import { countVotes, resetElection } from "./fixtures";
import { pickVoter, vote } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("voter page on a phone", () => {
  test.beforeEach(async () => {
    await resetElection({ status: "open" });
  });

  test("shows the waiting screen while voting is not open", async ({ page }) => {
    await resetElection({ status: "draft" });
    await page.goto("/pilih");
    await expect(page.getByRole("heading", { name: "BELUM DIBUKA" })).toBeVisible();
    // The roster is not sent to the phone before voting opens.
    await expect(page.getByText("Andi Saputra")).toHaveCount(0);
    await resetElection({ status: "open" });
    await expect(page.getByRole("heading", { name: "Kamu perwakilan apa?" })).toBeVisible({ timeout: 15_000 });
  });

  test("kelompok -> kelas -> nama -> paslon, then the phone stays on the thank-you screen", async ({ page }) => {
    await page.goto("/pilih");
    await page.getByRole("button", { name: /Perwakilan Kelas/ }).click();
    // Only classes that have someone in this group.
    await expect(page.getByRole("button", { name: "X-3", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "X-1", exact: true }).click();
    // Laila Zahra (X-1) is in another group and is not listed here.
    await expect(page.getByRole("button", { name: /Laila Zahra/ })).toHaveCount(0);
    await page.getByRole("button", { name: /Andi Saputra/ }).click();

    await expect(page.getByText("Memilih sebagai")).toBeVisible();
    await page.getByRole("button", { name: /^Paslon 2:/ }).click();
    await expect(page.getByRole("dialog")).toContainText("Andi Saputra");
    await page.getByRole("button", { name: "Batal" }).click();
    expect((await countVotes()).total).toBe(0);

    await vote(page, 2);
    expect(await countVotes()).toEqual({ total: 1, byNumber: { 1: 0, 2: 1 } });
    await expect(page.getByText("Kamu boleh menutupnya")).toBeVisible();

    // Reloading does not bring the ballot back on this phone.
    await page.reload();
    await expect(page.getByRole("heading", { name: "TERIMA KASIH" })).toBeVisible();
    await page.goto("/pilih");
    await expect(page.getByRole("heading", { name: "TERIMA KASIH" })).toBeVisible();
  });

  test("a name that already voted is crossed out and cannot be picked on another phone", async ({ browser }) => {
    const first = await (await browser.newContext()).newPage();
    await pickVoter(first, "Ketua Eskul", "XI-3", "Farhan Akbar");
    await vote(first, 1);

    const second = await (await browser.newContext()).newPage();
    await second.goto("/pilih");
    await second.getByRole("button", { name: /Ketua Eskul/ }).click();
    await second.getByRole("button", { name: "XI-3", exact: true }).click();
    const farhan = second.getByRole("button", { name: /Farhan Akbar/ });
    await expect(farhan).toBeDisabled();
    await expect(farhan).toContainText("Sudah memilih");
  });

  test("two phones that picked the same name at once: the second gets a clear error", async ({ browser }) => {
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await pickVoter(a, "Perwakilan Kelas", "XI-2", "Dafa Hidayat");
    await pickVoter(b, "Perwakilan Kelas", "XI-2", "Dafa Hidayat");
    await vote(a, 1);

    await b.getByRole("button", { name: /^Paslon 2:/ }).click();
    await b.getByRole("button", { name: "Ya, kirim" }).click();
    await expect(b.getByRole("alert").filter({ hasText: "sudah dipakai untuk memilih" })).toBeVisible();
    await expect(b.getByRole("heading", { name: "TERIMA KASIH" })).toHaveCount(0);
    expect((await countVotes()).total).toBe(1);

    await b.getByRole("button", { name: "Kembali" }).click();
    await expect(b.getByRole("button", { name: /Dafa Hidayat/ })).toBeDisabled();
  });

  test("Pimpinan has no class, so the class step is skipped", async ({ page }) => {
    await page.goto("/pilih");
    await page.getByRole("button", { name: /Pimpinan/ }).click();
    await expect(page.getByRole("heading", { name: "Yang mana namamu?" })).toBeVisible();
    await page.getByRole("button", { name: /Budi Santoso/ }).click();
    await vote(page, 1);
    await page.goto("/pilih");
    await expect(page.getByRole("heading", { name: "TERIMA KASIH" })).toBeVisible();
  });

  test("'Pimpinan' back button returns to the group list", async ({ page }) => {
    await page.goto("/pilih");
    await page.getByRole("button", { name: /Pimpinan/ }).click();
    await page.getByRole("button", { name: "Kembali" }).click();
    await expect(page.getByRole("heading", { name: "Kamu perwakilan apa?" })).toBeVisible();
  });

  test("Guru types their own name and votes; the same name cannot vote again", async ({ page, browser }) => {
    await page.goto("/pilih");
    await page.getByRole("button", { name: /Guru/ }).click();
    await expect(page.getByRole("heading", { name: "Siapa nama Bapak/Ibu?" })).toBeVisible();
    const next = page.getByRole("button", { name: /Lanjut pilih paslon/ });
    await page.getByRole("textbox", { name: "Nama lengkap" }).fill("Al");
    await expect(next).toBeDisabled();
    await page.getByRole("textbox", { name: "Nama lengkap" }).fill("Ibu Siti Aminah, S.Pd.");
    await next.click();
    await expect(page.getByText("Ibu Siti Aminah, S.Pd.")).toBeVisible();
    await vote(page, 2);
    expect((await countVotes()).byNumber[2]).toBe(1);

    // Another phone typing the same name (different capitals) is refused.
    const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const b = await other.newPage();
    await b.goto("/pilih");
    await b.getByRole("button", { name: /Guru/ }).click();
    await b.getByRole("textbox", { name: "Nama lengkap" }).fill("ibu siti aminah, s.pd.");
    await b.getByRole("button", { name: /Lanjut pilih paslon/ }).click();
    await b.getByRole("button", { name: /^Paslon 1:/ }).click();
    await b.getByRole("button", { name: "Ya, kirim" }).click();
    await expect(b.getByText(/sudah dipakai untuk memilih/)).toBeVisible();
    await other.close();
    expect((await countVotes()).total).toBe(1);
  });

  test("'Bukan saya' goes back to the name list", async ({ page }) => {
    await pickVoter(page, "Perwakilan Kelas", "X-2", "Bunga Lestari");
    await page.getByRole("button", { name: "Bukan saya" }).click();
    await expect(page.getByRole("heading", { name: "Yang mana namamu?" })).toBeVisible();
  });

});
