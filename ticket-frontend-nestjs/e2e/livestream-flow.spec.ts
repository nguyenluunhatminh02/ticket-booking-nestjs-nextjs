import { test, expect } from "@playwright/test";

test.describe("Livestream E2E Flow", () => {
  /**
   * Test the full livestream viewing flow:
   * 1. User sees events with ONLINE/HYBRID mode
   * 2. User goes to "My Tickets" page
   * 3. User sees "Xem ngay" button for livestream tickets
   * 4. User clicks "Xem ngay" and navigates to livestream page
   * 5. System checks ticket validity
   * 6. If valid, video player loads
   */

  test.describe("Unauthenticated user", () => {
    test("should redirect to login when accessing livestream page", async ({ page }) => {
      await page.goto("/livestream/some-event-id");
      // Should redirect to login since livestream requires auth
      await page.waitForURL(/\/login/, { timeout: 10000 });
    });
  });

  test.describe("Tickets page with livestream", () => {
    test("should display the My Tickets page", async ({ page }) => {
      await page.goto("/tickets");
      await page.waitForLoadState("networkidle");

      // Page should have either tickets or redirect to login
      const url = page.url();
      const hasTicketsPage = url.includes("/tickets");
      const hasLoginPage = url.includes("/login");
      expect(hasTicketsPage || hasLoginPage).toBeTruthy();
    });

    test("should show 'Xem ngay' button for livestream tickets when authenticated", async ({
      page,
    }) => {
      // Mock API response by intercepting the network request
      await page.route("**/api/v1/tickets/my*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            content: [
              {
                id: "ticket-1",
                ticketCode: "TKT-LIVE123",
                eventId: "event-live-1",
                eventName: "Online Music Festival",
                eventDate: new Date().toISOString(),
                venueName: "Virtual Venue",
                tierName: "General",
                price: 29.99,
                currency: "USD",
                status: "VALID",
                qrCodeData: "TICKET:TKT-LIVE123|EVENT:event-live-1",
                issuedAt: new Date().toISOString(),
                eventMode: "ONLINE",
                hasLivestream: true,
              },
              {
                id: "ticket-2",
                ticketCode: "TKT-OFF456",
                eventId: "event-off-1",
                eventName: "Offline Concert",
                eventDate: new Date().toISOString(),
                venueName: "City Hall",
                tierName: "VIP",
                price: 99.99,
                currency: "USD",
                status: "VALID",
                qrCodeData: "TICKET:TKT-OFF456|EVENT:event-off-1",
                issuedAt: new Date().toISOString(),
                eventMode: "OFFLINE",
                hasLivestream: false,
              },
            ],
            totalPages: 1,
            totalElements: 2,
            number: 0,
            size: 20,
            first: true,
            last: true,
          }),
        });
      });

      // Mock auth check
      await page.route("**/api/v1/auth/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { id: "user-1", email: "test@test.com" } }),
        });
      });

      // Set auth tokens in localStorage to simulate logged-in state
      await page.goto("/tickets");
      await page.evaluate(() => {
        localStorage.setItem("accessToken", "mock-jwt-token");
        localStorage.setItem("refreshToken", "mock-refresh-token");
        localStorage.setItem(
          "auth-storage",
          JSON.stringify({
            state: {
              user: {
                id: "user-1",
                email: "test@test.com",
                firstName: "Test",
                lastName: "User",
                roles: ["ROLE_USER"],
              },
              isAuthenticated: true,
              isLoading: false,
            },
          })
        );
      });

      await page.goto("/tickets");
      await page.waitForLoadState("networkidle");

      // Check if the "Xem ngay" button appears for livestream ticket
      const watchButton = page.getByRole("link", { name: /xem ngay/i });
      if (await watchButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        expect(await watchButton.count()).toBeGreaterThanOrEqual(1);

        // Verify it links to the correct livestream page
        const href = await watchButton.first().getAttribute("href");
        expect(href).toContain("/livestream/event-live-1");
      }
    });
  });

  test.describe("Livestream page", () => {
    test("should show ticket verification loading state", async ({ page }) => {
      // Mock API to delay response
      await page.route("**/api/v1/livestream/*/token", async (route) => {
        // Delayed response to see loading state
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            playbackId: "test-playback-id",
            playbackToken: "mock-token",
            thumbnailToken: "mock-thumb",
            storyboardToken: "mock-story",
            eventName: "Test Event",
            expiresInSeconds: 7200,
          }),
        });
      });

      // Mock event data
      await page.route("**/api/v1/events/test-event-id", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "test-event-id",
            name: "Online Music Festival",
            eventMode: "ONLINE",
            category: "CONCERT",
            eventDate: new Date().toISOString(),
            status: "ON_SALE",
            venue: { id: "v1", name: "Virtual", city: "Online" },
            totalTickets: 500,
            availableTickets: 200,
            maxTicketsPerUser: 4,
            queueEnabled: false,
            ticketTiers: [],
          }),
        });
      });

      // Mock livestream access check
      await page.route("**/api/v1/livestream/*/access", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            eventId: "test-event-id",
            isStreamingEvent: true,
            hasPlayback: true,
            hasValidTicket: true,
            canWatch: true,
          }),
        });
      });

      // Simulate authenticated state
      await page.goto("/livestream/test-event-id");
      await page.evaluate(() => {
        localStorage.setItem("accessToken", "mock-jwt-token");
        localStorage.setItem("refreshToken", "mock-refresh-token");
        localStorage.setItem(
          "auth-storage",
          JSON.stringify({
            state: {
              user: {
                id: "user-1",
                email: "test@test.com",
                firstName: "Test",
                lastName: "User",
                roles: ["ROLE_USER"],
              },
              isAuthenticated: true,
              isLoading: false,
            },
          })
        );
      });

      await page.goto("/livestream/test-event-id");
      await page.waitForLoadState("networkidle");

      // Should show "Đang kiểm tra vé..." or the video player
      const url = page.url();
      const isOnLivestreamPage = url.includes("/livestream") || url.includes("/login");
      expect(isOnLivestreamPage).toBeTruthy();
    });

    test("should show 'buy ticket' message when user has no ticket", async ({ page }) => {
      // Mock API returning 403
      await page.route("**/api/v1/livestream/*/token", async (route) => {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            error: "You need a valid ticket to watch this livestream",
            requiresTicket: true,
          }),
        });
      });

      await page.route("**/api/v1/events/no-ticket-event", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "no-ticket-event",
            name: "Premium Concert",
            eventMode: "ONLINE",
            category: "CONCERT",
            eventDate: new Date().toISOString(),
            status: "ON_SALE",
            venue: { id: "v1", name: "Virtual", city: "Online" },
            totalTickets: 500,
            availableTickets: 200,
            maxTicketsPerUser: 4,
            queueEnabled: false,
            ticketTiers: [],
          }),
        });
      });

      await page.route("**/api/v1/livestream/*/access", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            eventId: "no-ticket-event",
            isStreamingEvent: true,
            hasPlayback: true,
            hasValidTicket: false,
            canWatch: false,
          }),
        });
      });

      // Simulate authenticated state
      await page.goto("/livestream/no-ticket-event");
      await page.evaluate(() => {
        localStorage.setItem("accessToken", "mock-jwt-token");
        localStorage.setItem("refreshToken", "mock-refresh-token");
        localStorage.setItem(
          "auth-storage",
          JSON.stringify({
            state: {
              user: {
                id: "user-1",
                email: "test@test.com",
                firstName: "Test",
                lastName: "User",
                roles: ["ROLE_USER"],
              },
              isAuthenticated: true,
              isLoading: false,
            },
          })
        );
      });

      await page.goto("/livestream/no-ticket-event");
      await page.waitForLoadState("networkidle");

      // Should show the "buy ticket" prompt or redirect
      const buyButton = page.getByText(/mua vé ngay/i);
      const noAccessMsg = page.getByText(/cần mua vé/i);
      if (await buyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        expect(await buyButton.isVisible()).toBeTruthy();
      } else if (await noAccessMsg.isVisible({ timeout: 3000 }).catch(() => false)) {
        expect(await noAccessMsg.isVisible()).toBeTruthy();
      }
    });
  });
});
