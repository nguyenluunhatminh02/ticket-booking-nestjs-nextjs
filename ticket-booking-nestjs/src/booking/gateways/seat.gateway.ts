import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { SeatLockService } from '../services/seat-lock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { parseCookies, ACCESS_COOKIE } from '../../auth/utils/auth-cookies';

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
    credentials: true,
  },
  namespace: '/',
  path: '/ws',
})
export class SeatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SeatGateway.name);

  private clientEvents = new Map<string, string>();
  private clientUsers = new Map<string, string>();
  // Lock ownership is tracked per socket so disconnecting one tab cannot release
  // locks acquired by another socket belonging to the same user.
  private clientLocks = new Map<string, Set<string>>();

  constructor(
    private readonly seatLockService: SeatLockService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const cookies = parseCookies({ headers: client.handshake.headers } as any);
      const token = (client.handshake.auth?.token as string) || cookies[ACCESS_COOKIE] || '';
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!token || !secret) throw new Error('missing credentials');
      const payload = jwt.verify(token, secret) as any;
      if (payload.type !== 'ACCESS' || !payload.sub) throw new Error('invalid token');
      client.data.userId = payload.sub as string;
      this.logger.debug(`Client authenticated: ${client.id}`);
    } catch {
      client.emit('seat-error', {
        type: 'AUTH_REQUIRED',
        message: 'Authentication required',
      });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
    const eventId = this.clientEvents.get(client.id);
    const userId = this.clientUsers.get(client.id);

    if (eventId && userId) {
      // Release only the locks acquired through this socket. Another socket of
      // the same user may still be actively using its own locks.
      const seatIds = this.clientLocks.get(client.id);
      if (seatIds) {
        for (const seatId of seatIds) {
          await this.seatLockService.unlockSeat(eventId, seatId, userId, client.id);
        }
      }
      const lockedSeats = await this.seatLockService.getLockedSeats(eventId);
      this.server.to(`event:${eventId}`).emit('seat-status-response', {
        type: 'SEAT_STATUS',
        lockedSeats,
      });
    }

    this.clientEvents.delete(client.id);
    this.clientUsers.delete(client.id);
    this.clientLocks.delete(client.id);
  }

  @SubscribeMessage('join-event')
  async handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string },
  ) {
    const userId = client.data.userId as string | undefined;
    const { eventId } = data;
    if (!eventId || !userId) return;

    const prevEventId = this.clientEvents.get(client.id);
    if (prevEventId && prevEventId !== eventId) {
      client.leave(`event:${prevEventId}`);
      const prevLocks = this.clientLocks.get(client.id);
      if (prevLocks) {
        for (const seatId of prevLocks) {
          await this.seatLockService.unlockSeat(prevEventId, seatId, userId, client.id);
        }
      }
      this.clientLocks.delete(client.id);
    }

    client.join(`event:${eventId}`);
    this.clientEvents.set(client.id, eventId);
    this.clientUsers.set(client.id, userId);
    if (!this.clientLocks.has(client.id)) {
      this.clientLocks.set(client.id, new Set<string>());
    }

    const lockedSeats = await this.seatLockService.getLockedSeats(eventId);
    client.emit('seat-status-response', {
      type: 'SEAT_STATUS',
      lockedSeats,
    });
  }

  @SubscribeMessage('lock-seat')
  async handleLockSeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string; seatId: string },
  ) {
    const userId = client.data.userId as string | undefined;
    const { eventId, seatId } = data;
    if (!eventId || !seatId || !userId) return;

    // Reject locks for seats that do not belong to the requested event before
    // writing any Redis state (locks for unknown seats can never be booked).
    const seat = await this.prisma.seat.findFirst({
      where: { id: seatId, eventId },
      select: { id: true },
    });
    if (!seat) {
      client.emit('seat-error', {
        type: 'SEAT_NOT_FOUND',
        seatId,
        message: 'Seat does not exist for this event',
      });
      return;
    }

    const locked = await this.seatLockService.lockSeat(eventId, seatId, userId, client.id);

    if (locked) {
      let ownedLocks = this.clientLocks.get(client.id);
      if (!ownedLocks) {
        ownedLocks = new Set<string>();
        this.clientLocks.set(client.id, ownedLocks);
      }
      ownedLocks.add(seatId);
      this.server.to(`event:${eventId}`).emit('seat-update', {
        type: 'SEAT_LOCKED',
        seatId,
        lockedBy: userId,
        ttl: 300,
      });
    } else {
      client.emit('seat-error', {
        type: 'SEAT_ALREADY_LOCKED',
        seatId,
        message: 'This seat is currently being selected by another user',
      });
    }
  }

  @SubscribeMessage('unlock-seat')
  async handleUnlockSeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string; seatId: string },
  ) {
    const userId = client.data.userId as string | undefined;
    const { eventId, seatId } = data;
    if (!eventId || !seatId || !userId) return;

    const unlocked = await this.seatLockService.unlockSeat(eventId, seatId, userId, client.id);

    if (unlocked) {
      this.clientLocks.get(client.id)?.delete(seatId);
      this.server.to(`event:${eventId}`).emit('seat-update', {
        type: 'SEAT_UNLOCKED',
        seatId,
      });
    }
  }

  @SubscribeMessage('seat-status')
  async handleSeatStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string },
  ) {
    const { eventId } = data;
    if (!eventId) return;

    const lockedSeats = await this.seatLockService.getLockedSeats(eventId);
    client.emit('seat-status-response', {
      type: 'SEAT_STATUS',
      lockedSeats,
    });
  }
}
