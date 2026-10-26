import type { Page } from "@playwright/test";
import { PASSWORD } from "./fixtures";

// Next.js adds its own empty role="alert" route announcer; skip it.
export const alertBox = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

export async function login(page: Page, path: "/admin/login" | "/bilik/login", username: string, password = PASSWORD) {
  await page.goto(path);
  await page.getByLabel("Nama akun").fill(username);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: /masuk/i }).click();
}
