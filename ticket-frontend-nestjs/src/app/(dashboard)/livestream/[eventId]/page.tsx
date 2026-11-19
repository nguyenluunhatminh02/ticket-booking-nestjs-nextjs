"use client";

import { useParams, useRouter } from "next/navigation";
import { useLivestreamAccess } from "@/hooks/use-livestream";
import { useEvent } from "@/hooks/use-booking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Monitor, Ticket, Clock } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const LivestreamPlayer = dynamic(
  () => import("@/components/booking/livestream-player"),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full aspect-video rounded-lg" />,
  }
);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LivestreamPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const { data: event, isLoading: eventLoading } = useEvent(eventId);
  const { data: access, isLoading: accessLoading } = useLivestreamAccess(eventId);

  if (eventLoading || accessLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="w-full aspect-video rounded-lg" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-xl font-semibold">Sự kiện không tìm thấy</p>
        <Link href="/events">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại sự kiện
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại vé của tôi
      </Link>

      {/* Event Header */}
      <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 -mx-4 px-4 py-6 rounded-xl">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge className="text-xs bg-indigo-100 text-indigo-700">
            <Monitor className="h-3 w-3 mr-1" />
            {event.eventMode === "HYBRID" ? "Hybrid" : "Online"}
          </Badge>
          <Badge variant="secondary">{event.category}</Badge>
          {access?.hasValidTicket && (
            <Badge variant="default" className="bg-green-600">
              <Ticket className="h-3 w-3 mr-1" /> Đã mua vé
            </Badge>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          {event.name}
        </h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(event.eventDate)}</span>
        </div>
      </div>

      {/* Video Player */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          <LivestreamPlayer
            eventId={eventId}
            eventName={event.name}
          />
        </CardContent>
      </Card>

      {/* Event Description */}
      {event.description && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Mô tả sự kiện</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {event.description}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
