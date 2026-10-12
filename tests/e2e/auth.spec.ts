import { expect, test, type Page } from "@playwright/test";
import { E2E_USERS, PASSWORD } from "./fixtures";

// Next.js adds its own empty role="alert" route announcer; skip it.
const alert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

async function login(page: Page, path: "/admin/login" | "/bilik/login", username: string, password = PASSWORD) {
  await page.goto(path);
  await page.getByLabel("Nama akun").fill(username);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: /masuk/i }).click();
}

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
