import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_USERS, resetElection } from "./fixtures";
import { login, pickVoter, vote } from "./helpers";

async function adminPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await login(page, "/admin/login", E2E_USERS.admin.username);
  await expect(page).toHaveURL(/\/admin$/);
  return page;
}

// Every voter uses their own phone: a fresh browser context per person.
async function phoneVote(browser: Browser, kelompok: string, kelas: string, nama: string, number: number) {
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await pickVoter(phone, kelompok, kelas, nama);
  await vote(phone, number);
  return phone;
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

  test("full flow: trial run, open, live counts per candidate and group, close, wipe", async ({ browser }) => {
    test.setTimeout(150_000);
    const admin = await adminPage(browser);
    await expect(admin.getByText("Draft", { exact: true })).toBeVisible();
    await expect(total(admin)).toHaveText("0");

    // Trial run: the vote appears live, then is purged, and the same person can vote for real.
    await lifecycle(admin, "Mulai uji coba", "Mulai uji coba");
    await expect(admin.getByText("Uji coba", { exact: true })).toBeVisible();
    const trialPhone = await phoneVote(browser, "Perwakilan Kelas", "X-1", "Andi Saputra", 2);
    await expect(total(admin)).toHaveText("1", { timeout: 6_000 });
    await lifecycle(admin, "Akhiri uji coba", "Akhiri uji coba");
    await expect(admin.getByText("1 suara uji dibersihkan")).toBeVisible();
    await expect(total(admin)).toHaveText("0");

    // Real voting.
    await lifecycle(admin, "Buka voting", "Ya, buka voting");
    await expect(admin.getByText("Dibuka", { exact: true })).toBeVisible();
    // The trial phone is free again because its trial vote was purged.
    await trialPhone.reload();
    await pickVoter(trialPhone, "Perwakilan Kelas", "X-1", "Andi Saputra");
    await vote(trialPhone, 1);

    await phoneVote(browser, "Ketua Eskul", "X-3", "Gita Permata", 1);
    await phoneVote(browser, "OSIS/MPK 2025/2026", "XI-4", "Jihan Aulia", 2);
    await phoneVote(browser, "Calon OSIS/MPK", "X-4", "Kevin Ramadhan", 1);

    await expect(total(admin)).toHaveText("4", { timeout: 6_000 });
    await expect(admin.getByTestId("turnout")).toHaveText("4/13");
    await expect(admin.getByTestId("result-1").getByTestId("votes")).toHaveText("3");
    await expect(admin.getByTestId("result-1").getByTestId("percent")).toHaveText("75,0%");
    await expect(admin.getByTestId("result-2").getByTestId("percent")).toHaveText("25,0%");
    await expect(admin.getByTestId("group-perwakilan_kelas")).toContainText("1/5");
    await expect(admin.getByTestId("group-ketua_eskul")).toContainText("1/3");

    await lifecycle(admin, "Tutup voting", "Ya, tutup voting");
    await expect(admin.getByText("Ditutup", { exact: true })).toBeVisible();
    await expect(total(admin)).toHaveText("4");

    await admin.getByRole("button", { name: "Hapus semua suara" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Ketik konfirmasi").fill("HAPUS SEMUA SUARA");
    await dialog.getByRole("button", { name: "Hapus permanen" }).click();
    await expect(admin.getByText("4 suara dihapus. Status kembali ke draft.")).toBeVisible();
    await expect(total(admin)).toHaveText("0");
  });

  test("cancel in the confirm dialog changes nothing", async ({ browser }) => {
    const admin = await adminPage(browser);
    await admin.getByRole("button", { name: "Buka voting", exact: true }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Batal" }).click();
    await expect(admin.getByText("Draft", { exact: true })).toBeVisible();
  });
});

test.describe("voter list (Pemilih)", () => {
  test.beforeEach(async () => {
    await resetElection({ status: "draft" });
  });

  test("paste names from Excel, skip duplicates, delete one", async ({ browser }) => {
    const admin = await adminPage(browser);
    await admin.goto("/admin/pemilih");
    await admin
      .getByRole("textbox", { name: "Tempel di sini" })
      .fill("Nama\tKelas\tKelompok\nZaki Firmansyah\tXI-5\tKetua eskul\nandi saputra\tX-1\tPerwakilan kelas");
    await expect(admin.getByText("2 nama siap ditambahkan")).toBeVisible();
    await admin.getByRole("button", { name: "Tambahkan 2 nama" }).click();
    await expect(admin.getByText(/1 nama ditambahkan\. 1 dilewati karena sudah ada: andi saputra \(X-1\)/)).toBeVisible();
    await expect(admin.getByTestId("voter-row")).toHaveCount(14);

    // A row with an unknown group blocks the whole paste.
    await admin.getByRole("textbox", { name: "Tempel di sini" }).fill("Siti\tX-2\tsatpam");
    await expect(admin.getByText(/perwakilan "satpam" tidak dikenal/)).toBeVisible();
    await expect(admin.getByRole("button", { name: /Tambahkan/ })).toBeDisabled();

    const zaki = admin.getByTestId("voter-row").filter({ hasText: "Zaki Firmansyah" });
    await zaki.getByRole("button", { name: "Hapus" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Ya, hapus" }).click();
    await expect(admin.getByText("Nama dihapus dari daftar.")).toBeVisible();
    await expect(admin.getByTestId("voter-row")).toHaveCount(13);

    // The new names show up for voters.
    await resetElection({ status: "open" });
    await admin.reload();
    await admin
      .getByRole("textbox", { name: "Tempel di sini" })
      .fill("Zaki Firmansyah\tXI-5");
    await admin.getByLabel("Perwakilan untuk baris tanpa kolom perwakilan").selectOption({ label: "Ketua Eskul" });
    await admin.getByRole("button", { name: "Tambahkan 1 nama" }).click();
    await expect(admin.getByText("1 nama ditambahkan.")).toBeVisible();
    const phone = await (await browser.newContext()).newPage();
    await pickVoter(phone, "Ketua Eskul", "XI-5", "Zaki Firmansyah");
  });

  test("admin sees who voted for whom and can cancel a vote so the person votes again", async ({ browser }) => {
    await resetElection({ status: "open" });
    const admin = await adminPage(browser);
    await admin.goto("/admin/pemilih");

    const phone = await phoneVote(browser, "Perwakilan Kelas", "XI-1", "Citra Maharani", 2);
    const row = admin.getByTestId("voter-row").filter({ hasText: "Citra Maharani" });
    await expect(row).toContainText("Memilih paslon 2", { timeout: 8_000 });
    await expect(admin.getByTestId("count-voted")).toHaveText("1");

    await row.getByRole("button", { name: "Batalkan suara" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Ya, batalkan" }).click();
    await expect(admin.getByText("Suara dibatalkan. Orang ini bisa memilih lagi.")).toBeVisible();
    await expect(row).toContainText("Belum memilih");

    // The same phone can vote again after the cancellation.
    await phone.reload();
    await pickVoter(phone, "Perwakilan Kelas", "XI-1", "Citra Maharani");
    await vote(phone, 1);
    await expect(row).toContainText("Memilih paslon 1", { timeout: 8_000 });

    await admin.goto("/admin/audit");
    await expect(admin.getByRole("cell", { name: "Membatalkan suara Citra Maharani (XI-1)" }).first()).toBeVisible();
  });
});
