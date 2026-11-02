import { expect, test } from "@playwright/test";
import path from "node:path";

test("User reports with GPS/photo; Admin processes; mobile-width layout remains usable", async ({
  browser,
}) => {
  test.skip(
    !process.env.E2E_ADMIN_PASSWORD,
    "Set E2E_ADMIN_PASSWORD for the isolated local/demo test Admin",
  );
  const context = await browser.newContext({
    permissions: ["geolocation"],
    geolocation: { latitude: -6.2, longitude: 106.8 },
    viewport: { width: 390, height: 844 },
  });
  const user = await context.newPage();
  await user.goto("/register");
  await user.getByLabel("Nama lengkap").fill("Pengujian E2E");
  await user
    .getByLabel("Email", { exact: true })
    .fill(`e2e-${Date.now()}@example.com`);
  await user.getByLabel(/^Password/).fill("E2ePassword123!");
  await user.getByRole("button", { name: "Buat akun", exact: true }).click();
  await expect(user).toHaveURL(/dashboard/);
  await expect(
    user.getByRole("link", { name: "Pengguna", exact: true }),
  ).toHaveCount(0);
  await user.getByRole("link", { name: "Buat laporan", exact: true }).click();
  await user
    .getByLabel("Unggah foto")
    .setInputFiles(path.join(__dirname, "fixtures/report.png"));
  await user.getByRole("button", { name: "Analisis foto dengan AI" }).click();
  await expect(user.getByRole("status")).toContainText("manual");
  await user
    .getByRole("textbox", { name: "Deskripsi", exact: true })
    .fill(
      "DATA UJI E2E: sampah sintetis untuk verifikasi alur, bukan laporan lapangan.",
    );
  await user
    .getByRole("combobox", { name: "Kategori", exact: true })
    .selectOption("paper");
  await user.getByRole("button", { name: "Ambil lokasi GPS" }).click();
  await expect(user.getByText("-6.200000, 106.800000")).toBeVisible();
  await user.getByRole("button", { name: "Kirim laporan" }).click();
  await expect(user).toHaveURL(/reports\/[a-f0-9-]+$/);
  const reportUrl = user.url();
  await expect(
    user.getByRole("heading", { name: "Kertas", exact: true }),
  ).toBeVisible();
  await user.screenshot({ path: "test-results/mobile-report.png", fullPage: true });
  expect(
    await user.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto("/login");
  await admin
    .getByLabel("Email", { exact: true })
    .fill(process.env.E2E_ADMIN_EMAIL || "admin@example.com");
  await admin
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD!);
  await admin.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(admin).toHaveURL(/dashboard/);
  await admin.screenshot({ path: "test-results/admin-dashboard.png", fullPage: true });
  await admin.goto(reportUrl);
  await admin
    .getByRole("combobox", { name: "Status berikutnya" })
    .selectOption("in_progress");
  await admin.getByRole("button", { name: "Simpan status" }).click();
  await expect(admin.locator(".page-heading .status")).toHaveText("Diproses");
  await admin
    .getByRole("combobox", { name: "Status berikutnya" })
    .selectOption("completed");
  await admin.getByRole("button", { name: "Simpan status" }).click();
  await expect(admin.locator(".page-heading .status")).toHaveText("Selesai");
  await user.reload();
  await expect(user.locator(".page-heading .status")).toHaveText("Selesai");
  await expect(
    user.getByRole("link", { name: "Edit laporan", exact: true }),
  ).toHaveCount(0);
  await admin.getByRole("link", { name: "Pengguna", exact: true }).click();
  await expect(
    admin.getByRole("heading", { name: "Manajemen pengguna" }),
  ).toBeVisible();
  await context.close();
  await adminContext.close();
});

test("GPS denial keeps form text and offers retry", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Nama lengkap").fill("GPS Test");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`gps-${Date.now()}@example.com`);
  await page.getByLabel(/^Password/).fill("E2ePassword123!");
  await page.getByRole("button", { name: "Buat akun", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/reports/new");
  await page
    .getByRole("textbox", { name: "Deskripsi", exact: true })
    .fill("Deskripsi ini harus tetap tersimpan saat izin lokasi ditolak.");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _ok: unknown,
          fail: (value: { code: number }) => void,
        ) => fail({ code: 1 }),
      },
    });
  });
  await page.reload();
  await page
    .getByRole("textbox", { name: "Deskripsi", exact: true })
    .fill("Deskripsi ini harus tetap tersimpan saat izin lokasi ditolak.");
  await page.getByRole("button", { name: "Ambil lokasi GPS" }).click();
  await expect(page.locator(".notice.error")).toContainText(
    "Izin lokasi ditolak",
  );
  await expect(
    page.getByRole("textbox", { name: "Deskripsi", exact: true }),
  ).toHaveValue(
    "Deskripsi ini harus tetap tersimpan saat izin lokasi ditolak.",
  );
});
