import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CheckInDto } from '../dto/request/check-in.dto';
import { CheckInService } from './check-in.service';
import {
  DYNAMIC_QR_WINDOW_MS,
  computeDynamicQrCode,
} from './ticket.service';
import { TicketStatus } from '../entities/enums';

/** Unit coverage for dynamic QR enforcement at check-in. All DB access is
 * mocked; timestamps and HMAC inputs are deterministic. */
describe('CheckInService dynamic QR verification', () => {
  const SECRET = 'server-side-qr-secret';
  const now = DYNAMIC_QR_WINDOW_MS * 100 + 10_000;
  const lockedTicket = {
    id: 'ticket-1',
    ticket_code: 'TKT-PUBLIC',
    event_id: 'event-1',
    status: TicketStatus.VALID,
  };

  let prisma: any;
  let config: any;
  let service: CheckInService;
  let clock: jest.SpyInstance;

  const qrFor = (slot: number) =>
    computeDynamicQrCode(
      {
        ticketId: lockedTicket.id,
        eventId: lockedTicket.event_id,
        timeSlot: slot,
        expiresAt: (slot + 1) * DYNAMIC_QR_WINDOW_MS,
      },
      SECRET,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    config = { get: jest.fn().mockReturnValue(SECRET) };
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([lockedTicket]),
      ticket: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          ticketCode: lockedTicket.ticket_code,
          tierName: 'VIP',
          seatLabel: 'A1',
          user: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
          event: { name: 'Concert' },
        }),
      },
      checkIn: { create: jest.fn().mockResolvedValue({ id: 'checkin-1', checkedInAt: new Date(now) }) },
    };
    service = new CheckInService(prisma, config);
  });

  afterEach(() => clock.mockRestore());

  const dto = (qrCode: string = qrFor(100)) => ({
    ticketCode: lockedTicket.ticket_code,
    qrCode,
    latitude: 10,
    longitude: 20,
    deviceInfo: 'scanner-1',
  });

  it('accepts a valid code for the current time slot and marks the ticket USED', async () => {
    const result = await service.checkIn(dto(qrFor(100)), { id: 'staff-1' });

    expect(result.successful).toBe(true);
    expect(result.failureReason).toBeNull();
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: lockedTicket.id },
      data: expect.objectContaining({ status: TicketStatus.USED }),
    });
    expect(prisma.checkIn.create).toHaveBeenCalled();
  });

  it('rejects a tampered code without mutating the ticket', async () => {
    const valid = qrFor(100);
    const tampered = (valid[0] === 'A' ? 'B' : 'A') + valid.slice(1);
    const result = await service.checkIn(dto(tampered), { id: 'staff-1' });

    expect(result.successful).toBe(false);
    expect(result.failureReason).toMatch(/QR/i);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(prisma.checkIn.create).not.toHaveBeenCalled();
  });

  it('accepts a previous-slot code within the 30-second tolerance', async () => {
    // `now` is 10s into slot 100: slot 99 expired only 10s ago.
    const result = await service.checkIn(dto(qrFor(99)), { id: 'staff-1' });

    expect(result.successful).toBe(true);
    expect(prisma.ticket.update).toHaveBeenCalledTimes(1);
  });

  it('rejects a code from two slots ago (outside tolerance)', async () => {
    const result = await service.checkIn(dto(qrFor(98)), { id: 'staff-1' });

    expect(result.successful).toBe(false);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('rejects a missing QR code without mutating the ticket', async () => {
    const { qrCode: _omitted, ...missingQr } = dto();
    const result = await service.checkIn(missingQr as any, { id: 'staff-1' });

    expect(result.successful).toBe(false);
    expect(result.failureReason).toMatch(/QR/i);
    expect(config.get).toHaveBeenCalledWith('QR_SECRET');
    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(prisma.checkIn.create).not.toHaveBeenCalled();
  });

  it('rejects an empty QR code without mutating the ticket', async () => {
    const result = await service.checkIn(dto(''), { id: 'staff-1' });

    expect(result.successful).toBe(false);
    expect(result.failureReason).toMatch(/QR/i);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(prisma.checkIn.create).not.toHaveBeenCalled();
  });

  it('requires qrCode in the request DTO', async () => {
    const errors = await validate(
      plainToInstance(CheckInDto, { ticketCode: lockedTicket.ticket_code }),
    );

    expect(errors.some((error) => error.property === 'qrCode')).toBe(true);
  });

  it('accepts a well-formed mandatory QR request at the DTO level', async () => {
    const errors = await validate(
      plainToInstance(CheckInDto, dto()),
    );

    expect(errors).toHaveLength(0);
  });

  it('fails closed when QR_SECRET is missing', async () => {
    config.get.mockReturnValue(undefined);
    await expect(service.checkIn(dto(qrFor(100)), { id: 'staff-1' }))
      .rejects.toThrow(BadRequestException);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('rejects a code generated for a different ticket', async () => {
    const foreign = computeDynamicQrCode(
      {
        ticketId: 'ticket-other',
        eventId: lockedTicket.event_id,
        timeSlot: 100,
        expiresAt: 101 * DYNAMIC_QR_WINDOW_MS,
      },
      SECRET,
    );
    const result = await service.checkIn(dto(foreign), { id: 'staff-1' });

    expect(result.successful).toBe(false);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });
});
