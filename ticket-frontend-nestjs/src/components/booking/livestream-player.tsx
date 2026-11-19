"use client";

import { useEffect, useState, useMemo } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { useLivestreamToken } from "@/hooks/use-livestream";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, AlertCircle, RefreshCw, Lock, ShoppingCart, Clock } from "lucide-react";
import Link from "next/link";

interface LivestreamPlayerProps {
  eventId: string;
  eventName?: string;
  className?: string;
}

export default function LivestreamPlayer({ eventId, eventName, className }: LivestreamPlayerProps) {
  const { data: tokenData, isLoading, error, refetch, isError } = useLivestreamToken(eventId);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);

  // Set up token refresh timer
  useEffect(() => {
    if (tokenData?.expiresInSeconds) {
      // Refresh 5 minutes before expiry
      const refreshMs = (tokenData.expiresInSeconds - 300) * 1000;
      const timer = setTimeout(() => {
        refetch();
      }, Math.max(refreshMs, 60000)); // At least 1 minute

      setTokenExpiry(Date.now() + tokenData.expiresInSeconds * 1000);
      return () => clearTimeout(timer);
    }
  }, [tokenData, refetch]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={`border-0 shadow-sm ${className || ""}`}>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              Đang kiểm tra vé...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error: User doesn't have a valid ticket or event hasn't started
  if (isError) {
    const errorData = (error as any)?.response?.data;
    const requiresTicket = errorData?.requiresTicket;
    const eventNotStarted = errorData?.eventNotStarted;

    if (eventNotStarted) {
      const eventDateStr = errorData?.eventDate;
      const eventDate = eventDateStr ? new Date(eventDateStr) : null;
      return (
        <Card className={`border-0 shadow-sm ${className || ""}`}>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold">Sự kiện chưa bắt đầu</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Livestream sẽ mở khi sự kiện bắt đầu
                </p>
                {eventDate && (
                  <p className="text-sm font-medium text-blue-600 mt-2">
                    📅 {eventDate.toLocaleDateString("vi-VN", {
                      weekday: "long", year: "numeric", month: "long", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
              <CountdownTimer targetDate={eventDate} />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (requiresTicket) {
      return (
        <Card className={`border-0 shadow-sm ${className || ""}`}>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
                <Lock className="h-8 w-8 text-amber-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold">Bạn cần mua vé để xem</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Mua vé cho sự kiện này để truy cập livestream
                </p>
              </div>
              <Link href={`/events/${eventId}`}>
                <Button className="mt-2">
                  <ShoppingCart className="h-4 w-4 mr-2" /> Mua vé ngay
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {errorData?.error || "Không thể tải video. Vui lòng thử lại."}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Success: Show MuxPlayer
  if (!tokenData) {
    return null;
  }

  return (
    <div className={className}>
      <MuxPlayer
        playbackId={tokenData.playbackId}
        {...(tokenData.playbackToken ? {
          tokens: {
            playback: tokenData.playbackToken,
            thumbnail: tokenData.thumbnailToken,
            storyboard: tokenData.storyboardToken,
          }
        } : {})}
        metadata={{
          video_title: tokenData.eventName || eventName || "Livestream",
        }}
        streamType="on-demand"
        style={{ width: "100%", aspectRatio: "16/9" }}
        autoPlay={false}
        primaryColor="#6366f1"
        secondaryColor="#1e1b4b"
      />
      {tokenExpiry && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Phiên xem sẽ tự động gia hạn. Video được bảo mật bằng vé của bạn.
        </p>
      )}
    </div>
  );
}

/* ────── Countdown Timer ────── */
function CountdownTimer({ targetDate }: { targetDate: Date | null }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!targetDate) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (!targetDate) return null;

  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) {
    return (
      <Button onClick={() => window.location.reload()} className="mt-2">
        <RefreshCw className="h-4 w-4 mr-2" /> Sự kiện đã bắt đầu — Tải lại
      </Button>
    );
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex gap-3 mt-2">
      {days > 0 && <TimeBlock value={days} label="Ngày" />}
      <TimeBlock value={hours} label="Giờ" />
      <TimeBlock value={minutes} label="Phút" />
      <TimeBlock value={seconds} label="Giây" />
    </div>
  );
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-mono font-bold bg-gray-900 text-white rounded-lg px-3 py-2 min-w-[3rem] text-center">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  );
}
