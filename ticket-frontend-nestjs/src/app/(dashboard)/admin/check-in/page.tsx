"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useCheckIn } from "@/hooks/use-dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ScanLine, CheckCircle, XCircle, Keyboard, Camera,
  Users, Clock, AlertCircle, Trash2,
} from "lucide-react";
import type { CheckInResponse } from "@/types/booking";
import { useTranslation } from "@/lib/i18n";

const QrScanner = dynamic(() => import("@/components/booking/qr-scanner"), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse flex items-center justify-center">
      <Camera className="h-8 w-8 text-slate-400" />
    </div>
  ),
});

export default function AdminCheckInPage() {
  const [ticketCode, setTicketCode] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [qrError, setQrError] = useState("");
  const [results, setResults] = useState<CheckInResponse[]>([]);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const checkInMutation = useCheckIn();
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const total = results.length;
    const successful = results.filter((r) => r.successful).length;
    const failed = total - successful;
    return { total, successful, failed };
  }, [results]);

  const handleCheckIn = useCallback(
    async (code?: string) => {
      const codeToUse = (code || ticketCode).trim();
      const qrToUse = qrCode.trim();
      if (!codeToUse) return;
      if (!qrToUse) {
        setQrError("Dynamic QR code is required");
        return;
      }
      setQrError("");

      try {
        const result = await checkInMutation.mutateAsync({
          ticketCode: codeToUse,
          qrCode: qrToUse,
          deviceInfo: navigator.userAgent,
        });
        setResults((prev) => [result, ...prev]);
        setTicketCode("");
        inputRef.current?.focus();
      } catch (err: any) {
        // Build a failed result from the error for display
        const failureReason =
          err?.response?.data?.message || err?.message || "Unknown error";
        setResults((prev) => [
          {
            id: crypto.randomUUID(),
            ticketCode: codeToUse,
            successful: false,
            failureReason,
            checkedInAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setTicketCode("");
        inputRef.current?.focus();
      }
    },
    [ticketCode, qrCode, checkInMutation, t]
  );

  const handleQrScan = useCallback(
    (data: string) => {
      setScannerEnabled(false);
      // Scanned payload is the dynamic QR code; keep the ticket code from manual entry.
      setQrCode(data.trim());
      setTimeout(() => setScannerEnabled(true), 2000);
    },
    []
  );

  const clearResults = () => setResults([]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("checkIn.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("checkIn.subtitle")}
          </p>
        </div>
        {results.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearResults} className="text-muted-foreground">
            <Trash2 className="h-4 w-4 mr-1" /> {t("common.clearHistory")}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950 dark:to-blue-900/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">{t("checkIn.totalScans")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950 dark:to-emerald-900/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{stats.successful}</p>
                <p className="text-xs text-muted-foreground">{t("checkIn.success")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950 dark:to-red-900/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">{t("checkIn.failed")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scanner / Manual Entry Tabs */}
      <Tabs defaultValue="camera" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 h-11">
          <TabsTrigger value="camera" className="gap-1.5 text-sm">
            <Camera className="h-4 w-4" /> {t("checkIn.scanQrCode")}
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5 text-sm">
            <Keyboard className="h-4 w-4" /> {t("checkIn.manualEntry")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="camera">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="h-5 w-5" /> {t("checkIn.cameraScanner")}
              </CardTitle>
              <CardDescription>
                {t("checkIn.cameraDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QrScanner onScan={handleQrScan} enabled={scannerEnabled} />
              {checkInMutation.isPending && (
                <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  {t("common.loading")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Keyboard className="h-5 w-5" /> {t("checkIn.enterTicketCode")}
              </CardTitle>
              <CardDescription>
                {t("checkIn.manualDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="ticket-code">{t("tickets.code")}</Label>
                  <Input
                    id="ticket-code"
                    ref={inputRef}
                    placeholder={t("checkIn.ticketCodePlaceholder")}
                    value={ticketCode}
                    onChange={(e) => setTicketCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCheckIn()}
                    className="font-mono text-base h-11"
                    autoFocus
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="qr-code">{t("tickets.qrCode")}</Label>
                  <Input
                    id="qr-code"
                    placeholder="Dynamic QR code"
                    value={qrCode}
                    onChange={(e) => {
                      setQrCode(e.target.value);
                      if (qrError) setQrError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleCheckIn()}
                    className="font-mono text-base h-11"
                  />
                </div>
              </div>
              {qrError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {qrError}
                </p>
              )}
              <Button
                onClick={() => handleCheckIn()}
                disabled={checkInMutation.isPending || !ticketCode.trim() || !qrCode.trim()}
                size="lg"
                className="w-full sm:w-auto"
              >
                <ScanLine className="h-4 w-4 mr-1.5" />
                Check In
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("common.tip")}: {t("checkIn.usbTip")}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Results */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" /> {t("checkIn.checkInHistory")}
            </CardTitle>
            {results.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {results.length} {t("common.records")}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center py-12">
              <ScanLine className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("checkIn.noHistory")}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {results.map((result, i) => (
                <div
                  key={`${result.id || i}-${result.checkedInAt}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    result.successful
                      ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                      : "bg-red-50/50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                  }`}
                >
                  {result.successful ? (
                    <CheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm">
                        {result.successful ? t("checkIn.success") : t("checkIn.failed")}
                      </span>
                      {result.ticketCode && (
                        <Badge variant="outline" className="font-mono text-[10px] px-1.5">
                          {result.ticketCode}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {result.eventName && <p>Event: {result.eventName}</p>}
                      {result.attendeeName && <p>Attendee: {result.attendeeName}</p>}
                      {result.tierName && (
                        <p>
                          {result.tierName}
                          {result.seatLabel ? ` | Seat: ${result.seatLabel}` : ""}
                        </p>
                      )}
                      {result.failureReason && (
                        <p className="text-red-600 font-medium flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {result.failureReason}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70">
                        {new Date(result.checkedInAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
