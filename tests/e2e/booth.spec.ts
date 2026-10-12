import { expect, test, type Page } from "@playwright/test";
import { E2E_USERS, countVotes, resetElection, setElectionStatus } from "./fixtures";
import { alertBox, login } from "./helpers";

const CAST_VOTE = "**/rest/v1/rpc/cast_vote";

async function openBooth(page: Page) {
  await login(page, "/bilik/login", E2E_USERS.bilik.username);
  await expect(page).toHaveURL(/\/bilik$/);
}

const card = (page: Page, number: number) => page.getByRole("button", { name: new RegExp(`^Paslon ${number}:`) });

test.describe("booth", () => {
  test.beforeEach(async () => {
    await resetElection({ status: "open" });
  });

  test("shows a waiting message while the election is a draft", async ({ page }) => {
    await resetElection({ status: "draft" });
    await openBooth(page);
    await expect(page.getByRole("heading", { name: "BELUM DIBUKA" })).toBeVisible();
    await expect(page.getByText("Pemungutan suara belum dibuka")).toBeVisible();
  });

  test("shows four equal candidate cards with no links or logout", async ({ page }) => {
    await openBooth(page);
    await expect(page.getByRole("heading", { name: "PILIH PASLON" })).toBeVisible();
    for (const n of [1, 2, 3, 4]) await expect(card(page, n)).toBeVisible();

    const boxes = await Promise.all([1, 2, 3, 4].map((n) => card(page, n).boundingBox()));
    const sizes = boxes.map((b) => `${Math.round(b!.width)}x${Math.round(b!.height)}`);
    expect(new Set(sizes).size).toBe(1);

    await expect(page.getByRole("link")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /keluar|logout/i })).toHaveCount(0);
  });

  test("cancel closes the dialog without voting", async ({ page }) => {
    await openBooth(page);
    await card(page, 2).click();
    await expect(page.getByRole("dialog")).toContainText("Yakin memilih Paslon 2?");
    await page.getByRole("button", { name: "Batal" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect((await countVotes()).total).toBe(0);
  });

  test("confirming records exactly one vote, thanks for 4 seconds, then back to the cards", async ({ page }) => {
    await openBooth(page);
    await card(page, 3).click();
    const send = page.getByRole("button", { name: "Ya, kirim" });
    // A frantic double click must still produce one vote.
    await send.dblclick();
    await expect(page.getByRole("heading", { name: "TERIMA KASIH" })).toBeVisible();
    expect(await countVotes()).toMatchObject({ total: 1, byNumber: { 3: 1 } });

    await expect(page.getByRole("heading", { name: "PILIH PASLON" })).toBeVisible({ timeout: 6_000 });
    expect((await countVotes()).total).toBe(1);
  });

  test("network failure shows an error and retry, never a thank-you", async ({ page }) => {
    await openBooth(page);
    await page.route(CAST_VOTE, (route) => route.abort("internetdisconnected"));
    await card(page, 1).click();
    await page.getByRole("button", { name: "Ya, kirim" }).click();

    await expect(alertBox(page)).toContainText("koneksi");
    await expect(page.getByRole("heading", { name: "TERIMA KASIH" })).toHaveCount(0);
    expect((await countVotes()).total).toBe(0);

    await page.unroute(CAST_VOTE);
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await expect(page.getByRole("heading", { name: "TERIMA KASIH" })).toBeVisible();
    expect(await countVotes()).toMatchObject({ total: 1, byNumber: { 1: 1 } });
  });

  test("lost response after the vote was saved: retry does not double count", async ({ page }) => {
    await openBooth(page);
    // The request reaches the database, but the answer never makes it back.
    await page.route(CAST_VOTE, async (route) => {
      await route.fetch();
      await route.abort("connectionreset");
    });
    await card(page, 4).click();
    await page.getByRole("button", { name: "Ya, kirim" }).click();
    await expect(alertBox(page)).toBeVisible();
    expect((await countVotes()).total).toBe(1);

    await page.unroute(CAST_VOTE);
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await expect(page.getByRole("heading", { name: "TERIMA KASIH" })).toBeVisible();
    expect(await countVotes()).toMatchObject({ total: 1, byNumber: { 4: 1 } });
  });

  test("the confirm dialog cancels itself after 60 seconds", async ({ page }) => {
    await page.clock.install();
    await openBooth(page);
    await card(page, 1).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.clock.fastForward(30_000);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.clock.fastForward(31_000);
    await expect(page.getByRole("dialog")).toBeHidden();
    expect((await countVotes()).total).toBe(0);
  });

  test("switches to the closed message when the admin closes voting", async ({ page }) => {
    await openBooth(page);
    await expect(page.getByRole("heading", { name: "PILIH PASLON" })).toBeVisible();
    await setElectionStatus("closed");
    await expect(page.getByRole("heading", { name: "SUDAH DITUTUP" })).toBeVisible({ timeout: 15_000 });
  });

  test("trial mode shows a banner", async ({ page }) => {
    await resetElection({ status: "open", testMode: true });
    await openBooth(page);
    await expect(page.getByText(/Mode uji coba/i)).toBeVisible();
  });
});
