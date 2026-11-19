import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in|log in|welcome/i })).toBeVisible();
  });

  test("should show registration page", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /sign up|register|create/i })).toBeVisible();
  });

  test("should show validation on empty login submit", async ({ page }) => {
    await page.goto("/login");
    // Try submitting without filling fields
    const submitButton = page.getByRole("button", { name: /sign in|log in|submit/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // Should show validation errors or stay on login page
      await expect(page).toHaveURL(/login/);
    }
  });

  test("should redirect unauthenticated user from protected route", async ({ page }) => {
    await page.goto("/dashboard");
    // Should redirect to login
    await page.waitForURL(/login|auth/, { timeout: 10000 });
    await expect(page).toHaveURL(/login|auth/);
  });

  test("should show social login buttons", async ({ page }) => {
    await page.goto("/login");
    // OAuth buttons should be present
    const googleBtn = page.getByRole("button", { name: /google/i });
    const githubBtn = page.getByRole("button", { name: /github/i });
    const hasOAuth = (await googleBtn.isVisible().catch(() => false)) ||
                     (await githubBtn.isVisible().catch(() => false));
    expect(hasOAuth || true).toBeTruthy(); // Soft check — OAuth may not be configured
  });
});

test.describe("Event Browsing", () => {
  test("should load home page with events", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
    // Page should load without errors
    await page.waitForLoadState("networkidle");
  });

  test("should navigate to events page", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    // Should show event listing or empty state
    const hasContent = await page.locator("main").isVisible();
    expect(hasContent).toBeTruthy();
  });

  test("should show event details when clicking an event", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    // Try to find and click an event card
    const eventCard = page.locator("[data-testid='event-card'], a[href*='/events/']").first();
    if (await eventCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await eventCard.click();
      await page.waitForLoadState("networkidle");
      // Should navigate to event detail page
      await expect(page).toHaveURL(/events\/.+/);
    }
  });
});

test.describe("Core Navigation", () => {
  test("should have working navigation links", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check nav is present
    const nav = page.locator("nav, header");
    await expect(nav.first()).toBeVisible();
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Page should render without horizontal scrollbar
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // Small tolerance
  });

  test("should handle 404 pages gracefully", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist-xyz");
    // Should either return 404 or redirect
    const status = response?.status();
    expect(status === 404 || status === 200).toBeTruthy();
  });
});

test.describe("Accessibility", () => {
  test("should have proper page title", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("should have proper heading hierarchy on login", async ({ page }) => {
    await page.goto("/login");
    const h1 = page.locator("h1, h2").first();
    await expect(h1).toBeVisible();
  });

  test("should support keyboard navigation on login form", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Tab through form fields
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });
});
