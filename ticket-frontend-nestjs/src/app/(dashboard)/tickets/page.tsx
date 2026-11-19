"use client";

import { useState } from "react";
import { useMyTickets, useCancelTicket, useTicketQrCode, useDynamicQr } from "@/hooks/use-tickets";
import { useListForResale } from "@/hooks/use-resale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { Ticket, CalendarDays, MapPin, QrCode, XCircle, Search, ChevronLeft, ChevronRight, Monitor, Loader2, ArrowRightLeft, RefreshCw, AlertCircle } from "lucide-react";
import type { TicketStatus } from "@/types/booking";
import { useTranslation } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/api-client";

function StatusConfig() {
  const { t } = useTranslation();
  return {
    VALID: { variant: "default" as const, label: t("tickets.valid") },
    USED: { variant: "secondary" as const, label: t("tickets.used") },
    CANCELLED: { variant: "destructive" as const, label: t("tickets.cancelled") },
    EXPIRED: { variant: "outline" as const, label: t("tickets.expired") },
  };
}

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MyTicketsPage() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useMyTickets(page);
  const cancelMutation = useCancelTicket();
  const listForResaleMutation = useListForResale();
  const [showQr, setShowQr] = useState<string | null>(null);
  const [resaleError, setResaleError] = useState<string | null>(null);
  const { t } = useTranslation();
  const STATUS_CONFIG = StatusConfig();

  const handleListForResale = async (ticketId: string, price: number) => {
    setResaleError(null);
    try {
      await listForResaleMutation.mutateAsync({ ticketId, askingPrice: price });
    } catch (err) {
      setResaleError(getErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("tickets.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("tickets.subtitle")}</p>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="py-5">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const tickets = data?.content ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t("tickets.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data?.totalElements ? t("tickets.ticketCount", { count: data.totalElements }) : t("tickets.noTickets")}
        </p>
      </div>

      {!tickets.length ? (
        <div className="text-center py-20">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Search className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-semibold">{t("tickets.noTickets")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("tickets.noTicketsDesc")}</p>
          <Link href="/events">
            <Button className="mt-5">
              <CalendarDays className="h-4 w-4 mr-2" /> {t("tickets.browseEvents")}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {resaleError && (
            <Alert variant="destructive" className="animate-in slide-in-from-top-1">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{resaleError}</AlertDescription>
            </Alert>
          )}
          {tickets.map((ticket) => {
            const cfg = STATUS_CONFIG[ticket.status];
            return (
              <Card key={ticket.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="py-5">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Ticket className="h-5 w-5 text-primary" />
                        <h3 className="font-bold text-lg">{ticket.eventName}</h3>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(ticket.eventDate)}
                        </div>
                        {ticket.venueName && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {ticket.venueName}
                          </div>
                        )}
                        <div>{t("tickets.tier")}: <span className="font-medium text-foreground">{ticket.tierName}</span></div>
                        {ticket.seatLabel && <div>{t("tickets.seat")}: <span className="font-medium text-foreground">{ticket.seatLabel}</span></div>}
                        <div>{t("tickets.code")}: <span className="font-mono font-bold text-primary">{ticket.ticketCode}</span></div>
                        <div>{t("tickets.price")}: <span className="font-medium text-foreground">{ticket.price} {ticket.currency}</span></div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                      {/* Watch Now button for livestream events */}
                      {ticket.status === "VALID" && ticket.hasLivestream && (
                        <Link href={`/livestream/${ticket.eventId}`}>
                          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                            <Monitor className="h-4 w-4 mr-1" /> {t("events.watchNow")}
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setShowQr(showQr === ticket.ticketCode ? null : ticket.ticketCode)}
                      >
                        <QrCode className="h-4 w-4 mr-1" /> {t("tickets.qrCode")}
                      </Button>
                      {ticket.status === "VALID" && (
                        <Button
                          variant="destructive" size="sm"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(ticket.ticketCode)}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> {t("common.cancel")}
                        </Button>
                      )}
                      {ticket.status === "VALID" && (
                        <Button
                          variant="outline" size="sm"
                          disabled={listForResaleMutation.isPending}
                          onClick={() => handleListForResale(ticket.id, ticket.price)}
                        >
                          <ArrowRightLeft className="h-4 w-4 mr-1" /> Resale
                        </Button>
                      )}
                    </div>
                  </div>

                  {showQr === ticket.ticketCode && (
                    <DynamicQrDisplay ticketCode={ticket.ticketCode} />
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <Button
                variant="outline" size="sm"
                disabled={data.first}
                onClick={() => setPage(p => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                {t("common.page")} {data.number + 1} {t("common.of")} {data.totalPages}
              </span>
              <Button
                variant="outline" size="sm"
                disabled={data.last}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DynamicQrDisplay({ ticketCode }: { ticketCode: string }) {
  const { data: dynamicQr, isLoading: dynLoading, isError: dynError } = useDynamicQr(ticketCode);
  const { data: qrUrl, isLoading: staticLoading, isError: staticError } = useTicketQrCode(
    // Only fetch static QR when dynamic isn't available
    dynamicQr?.isDynamic === false || dynError ? ticketCode : null
  );
  const { t } = useTranslation();

  const isLoading = dynLoading || (dynError && staticLoading);

  return (
    <div className="mt-4 pt-4 border-t flex flex-col items-center gap-2">
      {isLoading && (
        <div className="w-48 h-48 border rounded-lg flex items-center justify-center bg-muted">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Dynamic TOTP QR */}
      {dynamicQr?.isDynamic && !dynLoading && (
        <>
          <div className="relative">
            <div className="w-48 h-48 border rounded-lg p-3 bg-white flex items-center justify-center">
              <div className="text-center">
                <QrCode className="h-16 w-16 text-primary mx-auto mb-2" />
                <p className="text-xs font-mono break-all text-muted-foreground">
                  {dynamicQr.qrData}
                </p>
              </div>
            </div>
            {/* Countdown ring */}
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-md">
              {dynamicQr.secondsRemaining}s
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Dynamic QR - auto-refreshes every {dynamicQr.refreshInterval}s
          </div>
        </>
      )}

      {/* Static QR fallback */}
      {(dynError || dynamicQr?.isDynamic === false) && !staticLoading && (
        <>
          {staticError && (
            <div className="w-48 h-48 border rounded-lg flex items-center justify-center bg-destructive/10">
              <p className="text-sm text-destructive text-center px-4">{t("tickets.qrLoadFailed")}</p>
            </div>
          )}
          {qrUrl && (
            <img
              src={qrUrl}
              alt={`QR Code for ${ticketCode}`}
              className="w-48 h-48 border rounded-lg p-2 bg-white"
            />
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {t("tickets.qrPresent")}
      </p>
    </div>
  );
}