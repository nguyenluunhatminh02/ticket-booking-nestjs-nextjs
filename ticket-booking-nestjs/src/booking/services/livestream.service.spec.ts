import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { LivestreamService } from './livestream.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketStatus } from '../entities/enums';

describe('LivestreamService', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  const event = {
    id: 'event-1',
    name: 'Concert',
    muxPlaybackId: 'playback-1',
    streamingUrl: 'https://stream.example/live',
  };

  let prisma: any;
  let config: any;
  let service: LivestreamService;

  beforeEach(() => {
    prisma = {
      event: { findUnique: jest.fn().mockResolvedValue(event) },
      ticket: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ticket-1', status: TicketStatus.VALID }),
      },
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'MUX_TOKEN_ID') return 'key-id-1';
        if (key === 'MUX_TOKEN_SECRET') return privateKey;
        return undefined;
      }),
    };
    service = new LivestreamService(prisma as PrismaService, config as ConfigService);
  });

  it('rejects a user without a valid ticket', async () => {
    prisma.ticket.findFirst.mockResolvedValue(null);
    await expect(service.getLivestreamToken('event-1', 'user-1')).rejects.toThrow(ForbiddenException);
  });

  it('fails closed when Mux credentials are not configured', async () => {
    config.get.mockReturnValue(undefined);
    await expect(service.getLivestreamToken('event-1', 'user-1')).rejects.toThrow(BadRequestException);
  });

  it('issues an RS256 signed JWT that cannot be tampered with', async () => {
    const result = await service.getLivestreamToken('event-1', 'user-1');

    const decoded = jwt.verify(result.playbackToken, publicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;
    expect(decoded.sub).toBe('event-1:user-1');
    expect(decoded.aud).toBe('v');
    expect(jwt.decode(result.playbackToken, { complete: true })?.header.alg).toBe('RS256');

    const [header, , signature] = result.playbackToken.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...decoded, sub: 'event-2:attacker' }),
    ).toString('base64url');
    const forged = `${header}.${forgedPayload}.${signature}`;
    expect(() => jwt.verify(forged, publicKey, { algorithms: ['RS256'] })).toThrow();
  });

  it('throws NotFoundException for an unknown event', async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    await expect(service.getLivestreamToken('missing', 'user-1')).rejects.toThrow(NotFoundException);
  });
});
