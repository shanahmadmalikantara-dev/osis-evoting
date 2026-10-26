import { expect, type Page } from "@playwright/test";
import { PASSWORD } from "./fixtures";

// Next.js adds its own empty role="alert" route announcer; skip it.
export const alertBox = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

export async function login(page: Page, path: "/admin/login", username: string, password = PASSWORD) {
  await page.goto(path);
  await page.getByLabel("Nama akun").fill(username);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: /masuk/i }).click();
}

// Voter flow on /pilih up to the candidate cards.
export async function pickVoter(page: Page, kelompok: string, kelas: string, nama: string) {
  if (!page.url().endsWith("/pilih")) await page.goto("/pilih");
  await page.getByRole("button", { name: new RegExp(kelompok) }).click();
  await page.getByRole("button", { name: kelas, exact: true }).click();
  await page.getByRole("button", { name: new RegExp(nama) }).click();
  await expect(page.getByRole("heading", { name: "PILIH PASLON" })).toBeVisible();
}

export async function vote(page: Page, number: number) {
  await page.getByRole("button", { name: new RegExp(`^Paslon ${number}:`) }).click();
  await page.getByRole("button", { name: "Ya, kirim" }).click();
  await expect(page.getByRole("heading", { name: "TERIMA KASIH" })).toBeVisible();
}
