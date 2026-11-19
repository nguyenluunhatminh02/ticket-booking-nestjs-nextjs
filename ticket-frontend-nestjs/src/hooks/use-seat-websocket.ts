"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, type Socket } from "socket.io-client";

export interface SeatLockMessage {
  type: "SEAT_LOCKED" | "SEAT_UNLOCKED";
  seatId: string;
  lockedBy?: string;
  ttl?: number;
}

export interface SeatStatusMessage {
  type: "SEAT_STATUS";
  lockedSeats: Record<string, string>;
}

export interface SeatErrorMessage {
  type: "SEAT_ALREADY_LOCKED" | "AUTH_REQUIRED";
  seatId?: string;
  message: string;
}

const rawWsUrl =
  process.env.NEXT_PUBLIC_WS_URL ||
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1").replace("/api/v1", "");
const WS_URL = rawWsUrl.startsWith("http") ? rawWsUrl : "http://localhost:3001";

interface UseSeatWebSocketOptions {
  eventId: string;
  userId?: string;
  onSeatLocked?: (msg: SeatLockMessage) => void;
  onSeatUnlocked?: (msg: SeatLockMessage) => void;
  onSeatStatus?: (msg: SeatStatusMessage) => void;
  onSeatError?: (msg: SeatErrorMessage) => void;
  enabled?: boolean;
}

export function useSeatWebSocket({
  eventId,
  userId,
  onSeatLocked,
  onSeatUnlocked,
  onSeatStatus,
  onSeatError,
  enabled = true,
}: UseSeatWebSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lockedSeats, setLockedSeats] = useState<Record<string, string>>({});

  const callbacksRef = useRef({ onSeatLocked, onSeatUnlocked, onSeatStatus, onSeatError });
  callbacksRef.current = { onSeatLocked, onSeatUnlocked, onSeatStatus, onSeatError };

  useEffect(() => {
    if (!enabled || !eventId || !userId) return;

    const socket = io(WS_URL, {
      path: "/ws",
      withCredentials: true,
      reconnectionDelay: 5000,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-event", { eventId });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[WS] connection error:", err.message);
      }
      setConnected(false);
    });

    socket.on("seat-update", (data: SeatLockMessage) => {
      if (data.type === "SEAT_LOCKED") {
        setLockedSeats((prev) => ({ ...prev, [data.seatId]: data.lockedBy || "" }));
        callbacksRef.current.onSeatLocked?.(data);
      } else if (data.type === "SEAT_UNLOCKED") {
        setLockedSeats((prev) => {
          const next = { ...prev };
          delete next[data.seatId];
          return next;
        });
        callbacksRef.current.onSeatUnlocked?.(data);
      }
    });

    socket.on("seat-error", (data: SeatErrorMessage) => {
      callbacksRef.current.onSeatError?.(data);
    });

    socket.on("seat-status-response", (data: SeatStatusMessage) => {
      if (data.lockedSeats) {
        setLockedSeats(data.lockedSeats);
      }
      callbacksRef.current.onSeatStatus?.(data);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [eventId, userId, enabled]);

  const lockSeat = useCallback(
    (seatId: string) => {
      if (!socketRef.current?.connected || !userId) return;
      socketRef.current.emit("lock-seat", { eventId, seatId });
    },
    [eventId, userId]
  );

  const unlockSeat = useCallback(
    (seatId: string) => {
      if (!socketRef.current?.connected || !userId) return;
      socketRef.current.emit("unlock-seat", { eventId, seatId });
    },
    [eventId, userId]
  );

  return {
    connected,
    lockedSeats,
    lockSeat,
    unlockSeat,
  };
}
