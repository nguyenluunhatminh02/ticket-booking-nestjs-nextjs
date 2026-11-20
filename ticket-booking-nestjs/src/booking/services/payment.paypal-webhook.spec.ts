import { BadRequestException } from '@nestjs/common';
import { PaymentProvider, PaymentStatus } from '../entities/enums';
import { PaymentService } from './payment.service';

describe('PaymentService.handlePaypalWebhook', () => {
  let service: PaymentService;
  let mockPrisma: any;
  let mockTx: any;
  let configService: any;
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

  const event = {
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: { id: 'capture-1' },
  };

  beforeEach(() => {
    originalFetch = global.fetch;
    mockTx = {
      payment: { findFirst: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    };
    mockPrisma = {
      payment: mockTx.payment,
      $transaction: jest.fn((fn: any) => fn(mockTx)),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'PAYPAL_CLIENT_ID') return 'client-id';
        if (key === 'PAYPAL_CLIENT_SECRET') return 'client-secret';
        if (key === 'PAYPAL_WEBHOOK_ID') return 'webhook-id';
        return undefined;
      }),
    };
    reservationService = {
      confirmReservation: jest.fn(),
      getReservationEntity: jest.fn().mockResolvedValue({ id: 'res-1' }),
    };
    ticketService = { issueTicketsForReservation: jest.fn() };
    resaleService = { completeResaleTransfer: jest.fn() };

    service = new PaymentService(
      mockPrisma as any,
      reservationService as any,
      ticketService as any,
      configService as any,
      resaleService as any,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockPaypalFetch = (verifyStatus: string) => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/v1/oauth2/token')) {
        return { ok: true, json: async () => ({ access_token: 'token-1' }) } as any;
      }
      return { ok: true, json: async () => ({ verification_status: verifyStatus }) } as any;
    }) as any;
  };

  it('fails closed when PayPal credentials are missing', async () => {
    configService.get.mockReturnValue(undefined);
    await expect(service.handlePaypalWebhook(JSON.stringify(event), headers)).rejects.toThrow(BadRequestException);
  });

  it('rejects a webhook with a failed signature verification', async () => {
    mockPaypalFetch('FAILURE');
    await expect(service.handlePaypalWebhook(JSON.stringify(event), headers)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('confirms a verified capture and issues tickets', async () => {
    mockPaypalFetch('SUCCESS');
    mockTx.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      provider: PaymentProvider.PAYPAL,
      providerPaymentId: 'capture-1',
      reservationId: 'res-1',
      status: PaymentStatus.PENDING,
    });

    await service.handlePaypalWebhook(JSON.stringify(event), headers);

    expect(mockTx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: PaymentStatus.COMPLETED }),
      }),
    );
    expect(reservationService.confirmReservation).toHaveBeenCalledWith('res-1', mockTx);
    expect(ticketService.issueTicketsForReservation).toHaveBeenCalled();
  });

  it('ignores unrelated PayPal event types', async () => {
    mockPaypalFetch('SUCCESS');
    await service.handlePaypalWebhook(
      JSON.stringify({ event_type: 'PAYMENT.CAPTURE.REFUNDED', resource: { id: 'capture-1' } }),
      headers,
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
