import { BadRequestException, NotFoundException } from '@nestjs/common';

// ReservationService constructs an ioredis client; keep unit tests offline.
jest.mock('ioredis', () => {
  const redis = { set: jest.fn(), eval: jest.fn(), disconnect: jest.fn() };
  return { __esModule: true, default: jest.fn().mockImplementation(() => redis) };
});

import { PaymentProvider, PaymentStatus, ReservationStatus } from '../entities/enums';
import { PaymentService } from './payment.service';
import { ReservationService } from './reservation.service';

/**
 * Late-payment expiry guard coverage.
 *
 * A webhook may arrive after a reservation expired or was cancelled.
 * `assertReservationPayable` re-reads the row inside the transaction
 * (SELECT ... FOR UPDATE) and throws unless the reservation is PENDING. A
 * null/missing expiry is allowed: those reservations never expire. A malformed
 * expiry is treated as expired. Both webhook paths must roll back instead of
 * confirming and issuing tickets. Mocked tx only; no live Redis, Postgres,
 * Stripe or PayPal calls.
 */
describe('late-payment expiry guard', () => {
  describe('ReservationService.assertReservationPayable', () => {
    let service: ReservationService;
    let mockTx: any;

    beforeEach(() => {
      jest.clearAllMocks();
      mockTx = {
        $queryRaw: jest.fn(),
        reservation: { findUnique: jest.fn() },
      };
      service = new ReservationService(
        mockTx as any,
        { getLockedSeats: jest.fn(), unlockSeat: jest.fn() } as any,
        { get: jest.fn().mockReturnValue(undefined) } as any,
      );
    });

    const payableRow = {
      id: 'res-1',
      status: ReservationStatus.PENDING,
      expires_at: new Date(Date.now() + 120_000),
    };

    it('accepts a PENDING reservation within its expiry using the locked read', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([payableRow]);
      await expect(service.assertReservationPayable('res-1', mockTx)).resolves.toBeUndefined();
      expect(mockTx.reservation.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an expired reservation with a locked read', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([
        { ...payableRow, expires_at: new Date(Date.now() - 1_000) },
      ]);
      await expect(service.assertReservationPayable('res-1', mockTx)).rejects.toThrow(
        new BadRequestException('Reservation has expired'),
      );
    });

    it('rejects a cancelled reservation', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([
        { ...payableRow, status: ReservationStatus.CANCELLED },
      ]);
      await expect(service.assertReservationPayable('res-1', mockTx)).rejects.toThrow(
        new BadRequestException('Reservation is not pending'),
      );
    });

    it('accepts a PENDING reservation with a missing or null expiry (never expires)', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([{ id: 'res-1', status: ReservationStatus.PENDING }]);
      await expect(service.assertReservationPayable('res-1', mockTx)).resolves.toBeUndefined();

      mockTx.$queryRaw.mockResolvedValueOnce([
        { id: 'res-1', status: ReservationStatus.PENDING, expires_at: null },
      ]);
      await expect(service.assertReservationPayable('res-1', mockTx)).resolves.toBeUndefined();
    });

    it('rejects a malformed expiry as expired', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([
        { id: 'res-1', status: ReservationStatus.PENDING, expires_at: 'not-a-date' },
      ]);
      await expect(service.assertReservationPayable('res-1', mockTx)).rejects.toThrow(
        new BadRequestException('Reservation has expired'),
      );
    });

    it('fails closed when the reservation disappeared before the lock', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([]);
      await expect(service.assertReservationPayable('res-1', mockTx)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('supports a lightweight client without $queryRaw (fallback read)', async () => {
      const client = { reservation: { findUnique: jest.fn().mockResolvedValue(payableRow) } };
      await expect(service.assertReservationPayable('res-1', client)).resolves.toBeUndefined();
    });
  });

  describe('Stripe webhook fails closed for a late payment', () => {
    let service: PaymentService;
    let mockPrisma: any;
    let mockTx: any;
    let ticketService: any;
    let reservationService: any;
    let resaleService: any;

    beforeEach(() => {
      jest.clearAllMocks();
      mockTx = {
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn(),
        payment: { update: jest.fn() },
      };
      mockPrisma = {
        $transaction: jest.fn((fn: any) => fn(mockTx)),
        $executeRaw: jest.fn().mockResolvedValue(1),
      };
      ticketService = { issueTicketsForReservation: jest.fn() };
      reservationService = {
        assertReservationPayable: jest.fn().mockRejectedValue(
          new BadRequestException('Reservation has expired'),
        ),
        confirmReservation: jest.fn(),
        getReservationEntity: jest.fn(),
      };
      resaleService = {
        refundPaymentViaStripe: jest.fn().mockResolvedValue(true),
      };
      service = new PaymentService(
        mockPrisma as any,
        reservationService as any,
        ticketService as any,
        {
          get: jest.fn((key: string) => {
            if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
            if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
            return null;
          }),
        } as any,
        resaleService as any,
      );
      (service as any).stripeClient = {
        webhooks: {
          constructEvent: jest.fn().mockReturnValue({
            type: 'payment_intent.succeeded',
            data: { object: { id: 'pi_late', amount_received: 5000, currency: 'usd' } },
          }),
        },
      };
    });

    it('rolls back fulfillment, marks FAILED and refunds after the transaction', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([{
        id: 'pay-late',
        amount: 50,
        currency: 'USD',
        reservation_id: 'res-late',
        resale_listing_id: null,
      }]);

      await expect(service.handleStripeWebhook('{}', 'sig')).rejects.toThrow(/payment refunded/);

      expect(reservationService.assertReservationPayable).toHaveBeenCalledWith('res-late', mockTx);
      expect(mockTx.payment.update).not.toHaveBeenCalled();
      expect(reservationService.confirmReservation).not.toHaveBeenCalled();
      expect(ticketService.issueTicketsForReservation).not.toHaveBeenCalled();
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(resaleService.refundPaymentViaStripe).toHaveBeenCalledTimes(1);
    });
  });

  describe('PayPal webhook fails closed for a late payment', () => {
    let service: PaymentService;
    let mockPrisma: any;
    let mockTx: any;
    let reservationService: any;
    let ticketService: any;
    let resaleService: any;
    let originalFetch: typeof global.fetch;

    const headers = {
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://example.com/cert.pem',
      'paypal-transmission-id': 'transmission-1',
      'paypal-transmission-sig': 'signature-1',
      'paypal-transmission-time': '2026-11-20T00:00:00Z',
    };
    const payload = JSON.stringify({
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'capture-late' },
    });

    beforeEach(() => {
      originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('/v1/oauth2/token')) {
          return { ok: true, json: async () => ({ access_token: 'token-1' }) } as any;
        }
        return { ok: true, json: async () => ({ verification_status: 'SUCCESS' }) } as any;
      }) as any;

      mockTx = { payment: { findFirst: jest.fn(), update: jest.fn() } };
      mockPrisma = {
        $transaction: jest.fn((fn: any) => fn(mockTx)),
        $executeRaw: jest.fn().mockResolvedValue(1),
      };
      reservationService = {
        assertReservationPayable: jest.fn().mockRejectedValue(
          new BadRequestException('Reservation has expired'),
        ),
        confirmReservation: jest.fn(),
        getReservationEntity: jest.fn(),
      };
      ticketService = { issueTicketsForReservation: jest.fn() };
      resaleService = { refundPaymentViaStripe: jest.fn().mockResolvedValue(true) };
      service = new PaymentService(
        mockPrisma as any,
        reservationService as any,
        ticketService as any,
        {
          get: jest.fn((key: string) => {
            if (key === 'PAYPAL_CLIENT_ID') return 'client-id';
            if (key === 'PAYPAL_CLIENT_SECRET') return 'client-secret';
            if (key === 'PAYPAL_WEBHOOK_ID') return 'webhook-id';
            return undefined;
          }),
        } as any,
        resaleService as any,
      );
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('does not fulfill an expired reservation and requires a manual PayPal refund', async () => {
      mockTx.payment.findFirst.mockResolvedValue({
        id: 'pay-late-paypal',
        provider: PaymentProvider.PAYPAL,
        providerPaymentId: 'capture-late',
        reservationId: 'res-late',
        status: PaymentStatus.PENDING,
      });

      await expect(service.handlePaypalWebhook(payload, headers)).rejects.toThrow(
        /manual PayPal refund required/,
      );

      expect(reservationService.assertReservationPayable).toHaveBeenCalledWith('res-late', mockTx);
      expect(mockTx.payment.update).not.toHaveBeenCalled();
      expect(ticketService.issueTicketsForReservation).not.toHaveBeenCalled();
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
      // A PayPal capture id is not a Stripe payment intent: never call Stripe.
      expect(resaleService.refundPaymentViaStripe).not.toHaveBeenCalled();
    });
  });
});
