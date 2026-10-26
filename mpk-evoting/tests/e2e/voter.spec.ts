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
    await expect(page.getByRole("heading", { name: "Kamu dari kelompok mana?" })).toBeVisible({ timeout: 15_000 });
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

  test("'Bukan saya' goes back to the name list", async ({ page }) => {
    await pickVoter(page, "Perwakilan Kelas", "X-2", "Bunga Lestari");
    await page.getByRole("button", { name: "Bukan saya" }).click();
    await expect(page.getByRole("heading", { name: "Yang mana namamu?" })).toBeVisible();
  });

});
