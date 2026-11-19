"use client";

import { useReservations, useCancelReservation } from "@/hooks/use-booking";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Ticket, CalendarDays, Clock, CreditCard, XCircle, ArrowRight, Search } from "lucide-react";
import type { ReservationStatus } from "@/types/booking";

const STATUS_CONFIG: Record<ReservationStatus, { variant: "default" | "secondary" | "destructive" | "outline"; icon: string; color: string }> = {
  PENDING: { variant: "outline", icon: "⏳", color: "text-amber-600" },
  CONFIRMED: { variant: "default", icon: "✅", color: "text-green-600" },
  EXPIRED: { variant: "secondary", icon: "⏰", color: "text-gray-500" },
  CANCELLED: { variant: "destructive", icon: "❌", color: "text-red-500" },
};

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReservationsPage() {
  const { data: reservations, isLoading } = useReservations();
  const cancelMutation = useCancelReservation();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My Reservations</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your event reservations</p>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">My Reservations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {reservations?.length ? `${reservations.length} reservation(s)` : "No reservations yet"}
        </p>
      </div>

      {!reservations?.length ? (
        <div className="text-center py-20">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Search className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-semibold">No reservations yet</p>
          <p className="text-sm text-muted-foreground mt-1">Browse events and book your first ticket!</p>
          <Link href="/events">
            <Button className="mt-5">
              <CalendarDays className="h-4 w-4 mr-2" /> Browse Events
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((res) => {
            const statusCfg = STATUS_CONFIG[res.status];
            return (
              <Card key={res.id} className="border-0 shadow-sm hover:shadow-md transition-all group">
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    {/* Ticket icon */}
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0
                      ${res.status === "CONFIRMED" ? "bg-green-50" : res.status === "PENDING" ? "bg-amber-50" : "bg-gray-50"}`}>
                      {statusCfg.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-sm truncate">{res.eventName}</h3>
                        <Badge variant={statusCfg.variant} className="text-[10px] px-2 uppercase tracking-wider flex-shrink-0">
                          {res.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Ticket className="h-3 w-3" /> {res.ticketCount} ticket(s)
                        </span>
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" /> ${res.totalAmount.toFixed(2)} {res.currency}
                        </span>
                        {res.createdAt && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> {formatDate(res.createdAt)}
                          </span>
                        )}
                        {res.expiresAt && res.status === "PENDING" && (
                          <span className="flex items-center gap-1 text-amber-600 font-medium">
                            <Clock className="h-3 w-3" /> Expires {formatDate(res.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {res.status === "PENDING" && (
                        <>
                          <Link href={`/reservations/${res.id}`}>
                            <Button size="sm" className="h-8 text-xs font-bold shadow-sm">
                              Pay Now
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                            onClick={() => cancelMutation.mutate(res.id)}
                            disabled={cancelMutation.isPending}
                            title="Cancel reservation"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {res.status !== "PENDING" && (
                        <Link href={`/reservations/${res.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground group-hover:text-primary">
                            View <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
