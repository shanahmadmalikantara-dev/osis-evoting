import { expect, test } from "@playwright/test";
import { DOMAIN, E2E_USERS, withDb } from "./fixtures";
import { alertBox as alert, login } from "./helpers";

test("home shows the two entry buttons", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Lanjut sebagai Admin/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Lanjut sebagai Penyuara/ })).toBeVisible();
});

test("protected pages redirect to their login page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/bilik");
  await expect(page).toHaveURL(/\/bilik\/login$/);
});

test("wrong password shows an error", async ({ page }) => {
  await login(page, "/bilik/login", E2E_USERS.bilik2.username, "salah-total");
  await expect(alert(page)).toContainText("salah");
});

test("bilik logs in and is denied on /admin", async ({ page }) => {
  await login(page, "/bilik/login", E2E_USERS.bilik.username);
  await expect(page).toHaveURL(/\/bilik$/);
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(403);
  await expect(page.getByRole("heading", { name: "AKSES DITOLAK" })).toBeVisible();
});

test("a bilik account cannot log in through the admin form", async ({ page }) => {
  await login(page, "/admin/login", E2E_USERS.bilik2.username);
  await expect(alert(page)).toContainText("bukan akun admin");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("admin logs in and is denied on /bilik", async ({ page }) => {
  await login(page, "/admin/login", E2E_USERS.admin.username);
  await expect(page).toHaveURL(/\/admin$/);
  const response = await page.goto("/bilik");
  expect(response?.status()).toBe(403);
});

test("login is blocked after 5 wrong passwords, even with the right one", async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await login(page, "/bilik/login", E2E_USERS.locked.username, `salah-${i}`);
    await expect(alert(page)).toContainText("salah");
  }
  await login(page, "/bilik/login", E2E_USERS.locked.username);
  await expect(alert(page)).toContainText("Terlalu banyak percobaan");
});

test("one admin account works on two laptops; logging out on one keeps the other in", async ({ browser }) => {
  const laptopA = await browser.newContext();
  const laptopB = await browser.newContext();
  const a = await laptopA.newPage();
  const b = await laptopB.newPage();

  await login(a, "/admin/login", E2E_USERS.admin.username);
  await expect(a).toHaveURL(/\/admin$/);
  await login(b, "/admin/login", E2E_USERS.admin.username);
  await expect(b).toHaveURL(/\/admin$/);

  await a.getByRole("button", { name: "Keluar" }).click();
  await expect(a).toHaveURL(/\/$/);

  await b.goto("/admin");
  await expect(b).toHaveURL(/\/admin$/);
  await expect(b.getByTestId("total-votes")).toBeVisible();

  // Laptop B's session must still exist server-side, or it would be kicked out at the next
  // token refresh (a page check alone passes until the access token expires).
  const sessions = await withDb(async (db) => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from auth.sessions s join auth.users u on u.id = s.user_id where u.email = $1",
      [`${E2E_USERS.admin.username}@${DOMAIN}`],
    );
    return rows[0].n;
  });
  expect(sessions).toBeGreaterThanOrEqual(1);

  await laptopA.close();
  await laptopB.close();
});
