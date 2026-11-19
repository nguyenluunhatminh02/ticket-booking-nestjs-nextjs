import { describe, it, expect } from "vitest";
import type {
  EventResponse,
  ReservationResponse,
  PaymentResponse,
  QueuePositionResponse,
  ReserveTicketsRequest,
  Page,
  EventCategory,
  EventStatus,
  ReservationStatus,
  PaymentStatus,
  SeatStatus,
  QueueStatus,
  PaymentProvider,
  Venue,
  TicketTier,
  SeatResponse,
  SeatMapResponse,
  ReservationItem,
  PaymentProviderInfo,
  InitiatePaymentRequest,
} from "@/types/booking";

describe("Booking Types", () => {
  describe("Type Definitions", () => {
    it("should define EventResponse type correctly", () => {
      const event: EventResponse = {
        id: "1",
        name: "Test Concert",
        category: "CONCERT",
        status: "ON_SALE",
        eventDate: "2026-06-15T19:00:00Z",
        totalTickets: 500,
        availableTickets: 200,
        maxTicketsPerUser: 4,
        queueEnabled: false,
        venue: { id: "v1", name: "Grand Hall", city: "Saigon" },
        ticketTiers: [],
      };
      expect(event.id).toBe("1");
      expect(event.name).toBe("Test Concert");
      expect(event.venue.city).toBe("Saigon");
    });

    it("should define ReservationResponse type correctly", () => {
      const reservation: ReservationResponse = {
        id: "r1",
        eventName: "Concert",
        status: "PENDING",
        totalAmount: 100,
        currency: "USD",
        ticketCount: 2,
        items: [],
      };
      expect(reservation.status).toBe("PENDING");
      expect(reservation.ticketCount).toBe(2);
    });

    it("should define PaymentResponse type correctly", () => {
      const payment: PaymentResponse = {
        id: "p1",
        reservationId: "r1",
        amount: 100,
        currency: "USD",
        status: "COMPLETED",
        provider: "stripe",
        completedAt: "2026-01-01T00:00:00Z",
      };
      expect(payment.status).toBe("COMPLETED");
      expect(payment.clientSecret).toBeUndefined();
    });

    it("should define QueuePositionResponse type correctly", () => {
      const queue: QueuePositionResponse = {
        id: "q1",
        eventId: "e1",
        queueToken: "abc-123",
        position: 5,
        status: "WAITING",
        estimatedWaitMinutes: 10,
      };
      expect(queue.position).toBe(5);
      expect(queue.estimatedWaitMinutes).toBe(10);
    });

    it("should define ReserveTicketsRequest type correctly", () => {
      const request: ReserveTicketsRequest = {
        eventId: "e1",
        tierId: "t1",
        quantity: 2,
        seatIds: ["s1", "s2"],
      };
      expect(request.seatIds).toHaveLength(2);
      expect(request.quantity).toBe(2);
    });

    it("should define Page type correctly", () => {
      const page: Page<EventResponse> = {
        content: [],
        totalPages: 0,
        totalElements: 0,
        number: 0,
        size: 12,
        first: true,
        last: true,
      };
      expect(page.content).toHaveLength(0);
      expect(page.first).toBe(true);
    });

    it("should constrain category values", () => {
      const categories: EventCategory[] = [
        "CONCERT",
        "SPORTS",
        "THEATER",
        "COMEDY",
        "FESTIVAL",
        "CONFERENCE",
        "OTHER",
      ];
      expect(categories).toHaveLength(7);
    });

    it("should constrain event status values", () => {
      const statuses: EventStatus[] = [
        "DRAFT",
        "PUBLISHED",
        "ON_SALE",
        "PRESALE",
        "SOLD_OUT",
        "CANCELLED",
        "COMPLETED",
      ];
      expect(statuses).toHaveLength(7);
    });

    it("should constrain payment status values", () => {
      const statuses: PaymentStatus[] = [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "REFUNDED",
      ];
      expect(statuses).toHaveLength(5);
      expect(statuses).toContain("REFUNDED");
    });

    it("should define SeatMapResponse with sections", () => {
      const seatMap: SeatMapResponse = {
        eventId: "e1",
        eventName: "Concert",
        totalSeats: 100,
        availableSeats: 80,
        sections: {
          VIP: [
            {
              id: "s1",
              section: "VIP",
              rowName: "A",
              seatNumber: 1,
              status: "AVAILABLE",
              price: 150,
              currency: "USD",
              tierName: "VIP",
              label: "VIP-A1",
            },
          ],
        },
      };
      expect(seatMap.sections["VIP"]).toHaveLength(1);
      expect(seatMap.sections["VIP"][0].price).toBe(150);
    });
  });
});
