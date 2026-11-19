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

  constructor(
    private readonly seatLockService: SeatLockService,
    private readonly configService: ConfigService,
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
      await this.seatLockService.releaseAllUserLocks(eventId, userId);
      const lockedSeats = await this.seatLockService.getLockedSeats(eventId);
      this.server.to(`event:${eventId}`).emit('seat-status-response', {
        type: 'SEAT_STATUS',
        lockedSeats,
      });
    }

    this.clientEvents.delete(client.id);
    this.clientUsers.delete(client.id);
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
      await this.seatLockService.releaseAllUserLocks(prevEventId, userId);
    }

    client.join(`event:${eventId}`);
    this.clientEvents.set(client.id, eventId);
    this.clientUsers.set(client.id, userId);

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

    const locked = await this.seatLockService.lockSeat(eventId, seatId, userId);

    if (locked) {
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

    const unlocked = await this.seatLockService.unlockSeat(eventId, seatId, userId);

    if (unlocked) {
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
