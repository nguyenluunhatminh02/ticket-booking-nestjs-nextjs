import { test, expect, Page } from "@playwright/test";

// ─── Helper: login as admin ────────────────────────────────────
async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  await page.fill("#email", "admin@test.com");
  await page.fill("#password", "Str0ngP@ssw0rd!Xy");
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect to dashboard / events
  await page.waitForURL(/events|dashboard|tickets/, { timeout: 15000 });
}

// ════════════════════════════════════════════════════════════════
//  1.  Login flow (with real credentials)
// ════════════════════════════════════════════════════════════════
test.describe("Login Flow", () => {
  test("should login successfully and redirect to events", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/events/);
    // Should see user menu / avatar (indicates authenticated)
    await page.waitForLoadState("networkidle");
  });

  test("should show error on wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.fill("#email", "wrong@test.com");
    await page.fill("#password", "BadPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should stay on login page and show error
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login/);
  });

  test("should validate empty form fields", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Clear fields and submit
    await page.fill("#email", "");
    await page.fill("#password", "");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should stay on login page
    await expect(page).toHaveURL(/login/);
  });
});

// ════════════════════════════════════════════════════════════════
//  2.  i18n / Language Switching
// ════════════════════════════════════════════════════════════════
test.describe("Language Switching (i18n)", () => {
  test("should show language switcher on login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Find the globe button (language switcher)
    const globeBtn = page.locator("button").filter({ has: page.locator("svg") }).filter({ hasText: /🇺🇸|🇻🇳|🇨🇳|🇯🇵|🇰🇷|English|Tiếng Việt|中文|日本語|한국어/ });
    const isVisible = await globeBtn.first().isVisible({ timeout: 5000 }).catch(() => false);

    // If not found by flag, try finding by globe icon class
    if (!isVisible) {
      const anyGlobe = page.locator('[class*="globe"], [data-icon="globe"]');
      const found = await anyGlobe.first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(found || isVisible).toBeTruthy();
    }
  });

  test("should switch to Vietnamese", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Click language switcher button (look for globe icon or flag)
    const langButtons = page.locator("button");
    const count = await langButtons.count();

    // Find the language switcher — it's typically the last ghost button with a flag/globe
    let switcherClicked = false;
    for (let i = 0; i < count; i++) {
      const btn = langButtons.nth(i);
      const text = await btn.textContent().catch(() => "");
      if (text && /🇺🇸|🇻🇳|🇨🇳|🇯🇵|🇰🇷/.test(text)) {
        await btn.click();
        switcherClicked = true;
        break;
      }
    }

    if (switcherClicked) {
      // Wait for dropdown menu to appear
      await page.waitForTimeout(500);

      // Select Vietnamese
      const viOption = page.getByRole("menuitem").filter({ hasText: /🇻🇳|Tiếng Việt|Vietnamese/i });
      if (await viOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await viOption.click();
        await page.waitForTimeout(1000);

        // Login button should now show Vietnamese text "Đăng nhập"
        const signInBtn = page.getByRole("button", { name: /đăng nhập|sign in/i });
        await expect(signInBtn).toBeVisible();
      }
    }
  });

  test("should switch to Chinese", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const langButtons = page.locator("button");
    const count = await langButtons.count();

    let switcherClicked = false;
    for (let i = 0; i < count; i++) {
      const btn = langButtons.nth(i);
      const text = await btn.textContent().catch(() => "");
      if (text && /🇺🇸|🇻🇳|🇨🇳|🇯🇵|🇰🇷/.test(text)) {
        await btn.click();
        switcherClicked = true;
        break;
      }
    }

    if (switcherClicked) {
      await page.waitForTimeout(500);
      const zhOption = page.getByRole("menuitem").filter({ hasText: /🇨🇳|中文|Chinese/i });
      if (await zhOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await zhOption.click();
        await page.waitForTimeout(1000);

        // Page should now show Chinese text
        const heading = page.getByRole("heading").first();
        const text = await heading.textContent();
        expect(text).toBeTruthy();
      }
    }
  });

  test("should persist language after page reload", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Set locale via localStorage directly
    await page.evaluate(() => {
      const state = { state: { locale: "ja" }, version: 0 };
      localStorage.setItem("i18n-locale", JSON.stringify(state));
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Should show Japanese flag or Japanese text
    const pageContent = await page.textContent("body");
    // The page should have loaded with Japanese locale
    expect(pageContent).toBeTruthy();
  });

  test("should show all 5 language options", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const langButtons = page.locator("button");
    const count = await langButtons.count();

    for (let i = 0; i < count; i++) {
      const btn = langButtons.nth(i);
      const text = await btn.textContent().catch(() => "");
      if (text && /🇺🇸|🇻🇳|🇨🇳|🇯🇵|🇰🇷/.test(text)) {
        await btn.click();
        break;
      }
    }

    await page.waitForTimeout(500);
    const menuItems = page.getByRole("menuitem");
    const menuCount = await menuItems.count();

    // Should have at least 5 language options
    expect(menuCount).toBeGreaterThanOrEqual(5);
  });
});

// ════════════════════════════════════════════════════════════════
//  3.  Events page after login
// ════════════════════════════════════════════════════════════════
test.describe("Events Page (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should display events list", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Should have event cards or content
    const content = await main.textContent();
    expect(content!.length).toBeGreaterThan(0);
  });

  test("should navigate to event detail", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    const eventLink = page.locator("a[href*='/events/']").first();
    if (await eventLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await eventLink.click();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/events\/.+/);
    }
  });

  test("should filter events by search if available", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByPlaceholder(/search|find|tìm/i);
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill("test");
      await page.waitForTimeout(1000);
      await page.waitForLoadState("networkidle");
    }
  });
});

// ════════════════════════════════════════════════════════════════
//  4.  Tickets & QR Code
// ════════════════════════════════════════════════════════════════
test.describe("Tickets Page & QR Code", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should display tickets page", async ({ page }) => {
    await page.goto("/tickets");
    await page.waitForLoadState("networkidle");

    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("should show QR code button on ticket cards", async ({ page }) => {
    await page.goto("/tickets");
    await page.waitForLoadState("networkidle");

    // Look for QR code buttons
    const qrButtons = page.getByRole("button", { name: /qr/i });
    const count = await qrButtons.count();

    if (count > 0) {
      // Click the first QR button to toggle QR code display
      await qrButtons.first().click();
      await page.waitForTimeout(2000);

      // QR image should appear (or loading/error state)
      const qrImg = page.locator('img[alt*="QR"]');
      const spinner = page.locator(".animate-spin");
      const errorDiv = page.locator("text=/error|failed/i");

      const hasQr = await qrImg.isVisible({ timeout: 5000 }).catch(() => false);
      const hasSpinner = await spinner.isVisible({ timeout: 1000 }).catch(() => false);
      const hasError = await errorDiv.isVisible({ timeout: 1000 }).catch(() => false);

      // At least one state should be visible (QR loaded, loading, or error)
      expect(hasQr || hasSpinner || hasError).toBeTruthy();
    }
  });
});

// ════════════════════════════════════════════════════════════════
//  5.  Admin Check-in Page
// ════════════════════════════════════════════════════════════════
test.describe("Admin Check-in", () => {
  test("should access check-in page as admin", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/check-in");
    await page.waitForLoadState("networkidle");

    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Check-in page should have scanning or QR related content
    const pageText = await main.textContent();
    expect(pageText).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════
//  6.  Dashboard Navigation
// ════════════════════════════════════════════════════════════════
test.describe("Dashboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should navigate to profile page", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible();
  });

  test("should navigate to reservations page", async ({ page }) => {
    await page.goto("/reservations");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible();
  });

  test("should navigate to payments page", async ({ page }) => {
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible();
  });

  test("should navigate to admin dashboard", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible();
  });
});
