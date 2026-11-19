"use client";

import { useEvent, useSeatMap, useReserveTickets, useJoinQueue, useQueuePosition } from "@/hooks/use-booking";
import { useSeatSuggestions, useEventDynamicPrices } from "@/hooks/use-smart-seats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useParams, useRouter } from "next/navigation";
import { useState, Component } from "react";
import type { ReactNode } from "react";
import { MapPin, Calendar, Ticket, Users, ArrowLeft, Minus, Plus, ShoppingCart, Clock, AlertCircle, CheckCircle2, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import type { SeatResponse, TicketTier } from "@/types/booking";
import { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { useSeatWebSocket } from "@/hooks/use-seat-websocket";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const VenueMap = dynamic(() => import("@/components/booking/venue-map"), { ssr: false });
const Venue3DViewer = dynamic(() => import("@/components/booking/venue-3d-viewer"), { ssr: false });
const StadiumSeatMap = dynamic(() => import("@/components/booking/stadium-seat-map"), { ssr: false });
const CommentSection = dynamic(() => import("@/components/booking/comment-section"), { ssr: false });
const EventSchedule = dynamic(() => import("@/components/booking/event-schedule"), { ssr: false });
const EventMediaGallery = dynamic(() => import("@/components/booking/event-media-gallery"), { ssr: false });

class Viewer3DErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TIER_COLORS: Record<string, string> = {
  VIP: "border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50",
  PREMIUM: "border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50",
  GENERAL: "border-blue-300 bg-gradient-to-br from-blue-50 to-sky-50",
};

const TIER_ICONS: Record<string, string> = {
  VIP: "👑",
  PREMIUM: "⭐",
  GENERAL: "🎟️",
};

function SeatButton({ seat, selected, onToggle }: {
  seat: SeatResponse;
  selected: boolean;
  onToggle: () => void;
}) {
  if (seat.status !== "AVAILABLE") {
    return (
      <button
        disabled
        className="w-9 h-9 rounded-md text-[11px] font-medium bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200"
        title={seat.label}
      >
        {seat.seatNumber}
      </button>
    );
  }
  return (
    <button
      onClick={onToggle}
      className={`w-9 h-9 rounded-md text-[11px] font-bold transition-all border-2 ${
        selected
          ? "bg-primary text-primary-foreground border-primary shadow-md scale-110"
          : "bg-green-50 text-green-700 border-green-200 hover:border-green-400 hover:bg-green-100 hover:scale-105"
      }`}
      title={`${seat.label} - $${seat.price}`}
    >
      {seat.seatNumber}
    </button>
  );
}

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const { data: event, isLoading } = useEvent(eventId);
  const { data: seatMap } = useSeatMap(eventId);
  const reserveMutation = useReserveTickets();
  const joinQueueMutation = useJoinQueue();

  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [queueToken, setQueueToken] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const { user } = useAuthStore();

  // WebSocket for real-time seat locking
  const { connected: wsConnected, lockedSeats, lockSeat, unlockSeat } = useSeatWebSocket({
    eventId,
    userId: user?.id,
    enabled: !!seatMap && Object.keys(seatMap?.sections ?? {}).length > 0,
    onSeatError: (err) => {
      toast.error(err.message || "Seat is already locked by another user");
    },
  });
  const { data: queuePos } = useQueuePosition(queueToken);
  const { data: seatSuggestions } = useSeatSuggestions(
    eventId, selectedSeats.length === 0 ? quantity : undefined, selectedTier?.id
  );
  const { data: dynamicPrices } = useEventDynamicPrices(eventId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-xl font-semibold">Event not found</p>
        <Link href="/events"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Back to Events</Button></Link>
      </div>
    );
  }

  const toggleSeat = (seatId: string) => {
    // Ensure WebSocket is connected before attempting seat operations
    if (!wsConnected) {
      toast.error("Connecting to seat system, please wait...");
      return;
    }
    // Prevent selecting seats locked by other users
    if (lockedSeats[seatId] && lockedSeats[seatId] !== user?.id) {
      toast.error("This seat is currently locked by another user");
      return;
    }

    setSelectedSeats((prev) => {
      if (prev.includes(seatId)) {
        unlockSeat(seatId);
        return prev.filter((id) => id !== seatId);
      }
      if (prev.length < (event.maxTicketsPerUser || 4)) {
        lockSeat(seatId);
        return [...prev, seatId];
      }
      return prev;
    });
  };

  const handleReserve = async () => {
    if (!selectedTier) { setError("Please select a ticket tier"); return; }
    setError(null);
    try {
      const result = await reserveMutation.mutateAsync({
        eventId: event.id,
        tierId: selectedTier.id,
        seatIds: selectedSeats.length > 0 ? selectedSeats : undefined,
        quantity: selectedSeats.length > 0 ? selectedSeats.length : quantity,
      });
      router.push(`/reservations/${result.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleJoinQueue = async () => {
    try {
      const result = await joinQueueMutation.mutateAsync(event.id);
      setQueueToken(result.queueToken);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const totalPrice = selectedTier ? selectedTier.price * (selectedSeats.length || quantity) : 0;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Events
      </Link>

      {/* Event Header */}
      <div className="bg-gradient-to-br from-primary/5 via-white to-blue-50 -mx-4 px-4 py-6 rounded-xl">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge className="text-xs">{event.category}</Badge>
          <Badge variant={event.status === "ON_SALE" ? "default" : "secondary"}>
            {event.status.replace("_", " ")}
          </Badge>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{event.name}</h1>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 text-red-400" />
            <span>{event.venue.name}, {event.venue.city}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 text-blue-400" />
            <span>{formatDate(event.eventDate)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Ticket className="h-4 w-4 text-green-400" />
            <span>{event.availableTickets} of {event.totalTickets} tickets available</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4 text-purple-400" />
            <span>Max {event.maxTicketsPerUser} per user</span>
          </div>
        </div>
      </div>

      {/* Event Description */}
      {event.description && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Giới thiệu sự kiện</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{event.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Livestream button for ONLINE events */}
      {event.eventMode === "ONLINE" && event.muxPlaybackId && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-200">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-lg">📺</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-indigo-900">Sự kiện trực tuyến</p>
                <p className="text-xs text-indigo-600">Xem livestream hoặc video theo yêu cầu</p>
              </div>
            </div>
            <Link href={`/livestream/${event.id}`}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                Xem ngay
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Venue Map */}
      {event.venue?.latitude != null && event.venue?.longitude != null && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-400" /> Venue Location
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {event.venue.name}{event.venue.address ? `, ${event.venue.address}` : ""}, {event.venue.city}
              {event.venue.country ? `, ${event.venue.country}` : ""}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <VenueMap
              latitude={event.venue.latitude}
              longitude={event.venue.longitude}
              venueName={event.venue.name}
              address={`${event.venue.address || ""}, ${event.venue.city}${event.venue.country ? ", " + event.venue.country : ""}`}
              className="h-[300px] w-full"
            />
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive" className="animate-in slide-in-from-top-1">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Queue Section */}
      {event.queueEnabled && !queueToken && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900">Queue Required</p>
                <p className="text-sm text-amber-700">This event requires joining a queue before purchasing tickets.</p>
              </div>
            </div>
            <Button onClick={handleJoinQueue} disabled={joinQueueMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
              {joinQueueMutation.isPending ? "Joining..." : "Join Queue"}
            </Button>
          </CardContent>
        </Card>
      )}

      {queueToken && queuePos && queuePos.status === "WAITING" && (
        <Card className="border-yellow-300 bg-yellow-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center animate-pulse">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-semibold">You are in the queue</p>
                <p className="text-sm text-muted-foreground">
                  Position <strong className="text-foreground">{queuePos.position}</strong> of {queuePos.totalInQueue}
                  {queuePos.estimatedWaitMinutes && ` · ~${queuePos.estimatedWaitMinutes} min wait`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ticket Tiers */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Ticket className="h-5 w-5" /> Select Ticket Tier
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {event.ticketTiers.map((tier) => {
            const isSelected = selectedTier?.id === tier.id;
            const isSoldOut = tier.availableQuantity === 0;
            const tierKey = tier.name.toUpperCase();
            const colorClass = TIER_COLORS[tierKey] || "border-gray-200 bg-white";
            const icon = TIER_ICONS[tierKey] || "🎟️";
            const availPct = tier.totalQuantity > 0 ? (tier.availableQuantity / tier.totalQuantity) * 100 : 0;

            return (
              <Card
                key={tier.id}
                className={`cursor-pointer transition-all duration-200 border-2 relative overflow-hidden
                  ${isSelected ? "ring-2 ring-primary ring-offset-2 shadow-lg" : "hover:shadow-md hover:-translate-y-0.5"}
                  ${isSoldOut ? "opacity-50 cursor-not-allowed grayscale" : ""}
                  ${colorClass}`}
                onClick={() => !isSoldOut && setSelectedTier(tier)}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>{icon}</span> {tier.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-extrabold">
                    ${tier.price.toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">{tier.currency}</span>
                  </p>
                  {/* Dynamic pricing indicator */}
                  {dynamicPrices && dynamicPrices[tier.id] && dynamicPrices[tier.id].multiplier != null && dynamicPrices[tier.id].multiplier !== 1.0 && (
                    <div className="flex items-center gap-1.5">
                      {dynamicPrices[tier.id].multiplier > 1.0 ? (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {Math.round((dynamicPrices[tier.id].multiplier - 1) * 100)}% surge
                        </Badge>
                      ) : (
                        <Badge className="text-xs gap-1 bg-green-600">
                          <TrendingDown className="h-3 w-3" />
                          {Math.round((1 - dynamicPrices[tier.id].multiplier) * 100)}% discount
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Now ${dynamicPrices[tier.id].dynamicPrice?.toFixed(2) ?? '—'}
                      </span>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{tier.availableQuantity} / {tier.totalQuantity}</span>
                      <span>{Math.round(availPct)}% left</span>
                    </div>
                    <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${availPct > 50 ? "bg-green-400" : availPct > 20 ? "bg-yellow-400" : "bg-red-400"}`}
                        style={{ width: `${availPct}%` }}
                      />
                    </div>
                  </div>
                  {tier.description && <p className="text-xs text-muted-foreground mt-1">{tier.description}</p>}
                  {isSoldOut && <Badge variant="destructive" className="text-xs">Sold Out</Badge>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Seat Map with 2D/3D Toggle */}
      {seatMap && Object.keys(seatMap.sections).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Seat Map</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {seatMap.availableSeats} available
                  {wsConnected && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Live
                    </span>
                  )}
                </span>
                <div className="flex bg-muted rounded-lg p-0.5">
                  <button
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      viewMode === "2d" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setViewMode("2d")}
                  >
                    2D
                  </button>
                  <button
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      viewMode === "3d" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setViewMode("3d")}
                  >
                    3D
                  </button>
                </div>
              </div>
            </div>
            {viewMode === "2d" && (
              <div className="flex gap-5 mt-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-green-500 rounded-full" /> Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-indigo-500 rounded-full" /> Selected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-gray-400 rounded-full" /> Unavailable
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {viewMode === "3d" ? (
              <Viewer3DErrorBoundary fallback={
                <div className="h-[500px] flex items-center justify-center text-muted-foreground text-sm">
                  3D view unavailable — WebGL not supported. Switch to 2D view.
                </div>
              }>
                <Venue3DViewer
                  seatMap={seatMap}
                  selectedSeats={selectedSeats}
                  onToggleSeat={toggleSeat}
                  lockedSeats={lockedSeats}
                  currentUserId={user?.id}
                  className="h-[500px]"
                />
              </Viewer3DErrorBoundary>
            ) : (
              <StadiumSeatMap
                seatMap={seatMap}
                selectedSeats={selectedSeats}
                onToggleSeat={toggleSeat}
                lockedSeats={lockedSeats}
                currentUserId={user?.id}
                className="h-[550px]"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Smart Seat Suggestions */}
      {selectedTier && seatSuggestions && seatSuggestions.length > 0 && seatMap && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-violet-50/50 to-indigo-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" /> Smart Seat Suggestions
            </CardTitle>
            <p className="text-xs text-muted-foreground">AI-recommended seats based on view quality and adjacency</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {seatSuggestions.slice(0, 5).map((sg, idx) => (
                <button
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:border-primary hover:shadow-sm transition-all text-left"
                  onClick={() => setSelectedSeats(sg.seats.map(s => s.id))}
                >
                  <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-600 font-bold text-sm flex items-center justify-center">
                    #{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sg.seats.map(s => s.label).join(", ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {sg.section} · Row {sg.row} · Score {Math.round(sg.score)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-primary">${sg.totalPrice.toFixed(2)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quantity (for GA without seat map) */}
      {selectedTier && selectedSeats.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-4 flex items-center gap-6">
            <span className="font-semibold text-sm">Quantity:</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-10 text-center font-bold text-lg">{quantity}</span>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setQuantity((q) => Math.min(event.maxTicketsPerUser, q + 1))}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="text-sm text-muted-foreground">
              Total: <span className="font-bold text-foreground text-lg">${totalPrice.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Schedule */}
      {event.schedules && event.schedules.length > 0 && (
        <EventSchedule schedules={event.schedules} />
      )}

      {/* Media Gallery */}
      <EventMediaGallery eventId={event.id} />

      {/* Comments */}
      <CommentSection eventId={event.id} currentUserId={user?.id} eventStatus={event.status} />

      {/* Sticky Purchase Bar */}
      {selectedTier && (
        <div className="sticky bottom-0 -mx-4 px-4 py-4 bg-white/95 backdrop-blur-md border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] rounded-t-xl z-10">
          <div className="flex items-center justify-between max-w-none">
            <div>
              <p className="text-sm text-muted-foreground">
                {selectedSeats.length > 0 ? `${selectedSeats.length} seat(s) selected` : `${quantity} ticket(s)`}
                <span className="mx-1.5">·</span>
                {selectedTier.name}
              </p>
              <p className="text-xl font-extrabold">${totalPrice.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{selectedTier.currency}</span></p>
            </div>
            <Button
              size="lg"
              onClick={handleReserve}
              disabled={reserveMutation.isPending || (event.queueEnabled && (!queuePos || queuePos.status !== "ACTIVE"))}
              className="h-12 px-8 text-base font-bold shadow-lg"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {reserveMutation.isPending ? "Reserving..." : "Reserve Tickets"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
