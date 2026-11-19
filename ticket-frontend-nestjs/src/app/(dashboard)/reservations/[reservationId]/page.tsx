"use client";

import { useParams, useRouter } from "next/navigation";
import {
  useReservation,
  useCancelReservation,
  useInitiatePayment,
  usePaymentStatus,
  usePaymentProviders,
  useRefundPayment,
  useValidateCoupon,
  useApplyCoupon,
  useRemoveCoupon,
} from "@/hooks/use-booking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Ticket, CreditCard, Shield, CheckCircle2, Loader2, ExternalLink, AlertTriangle, XCircle, RotateCcw, Tag, X } from "lucide-react";
import type { ReservationStatus, PaymentProvider } from "@/types/booking";
import { Input } from "@/components/ui/input";
import { StripeCheckout } from "@/components/booking/stripe-checkout";

const STATUS_CONFIG: Record<ReservationStatus, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock; color: string; bg: string }> = {
  PENDING: { variant: "outline", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  CONFIRMED: { variant: "default", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  EXPIRED: { variant: "secondary", icon: AlertTriangle, color: "text-gray-500", bg: "bg-gray-50" },
  CANCELLED: { variant: "destructive", icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
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

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Expired");
        clearInterval(interval);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
      setIsUrgent(mins < 5);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remaining === "Expired") {
    return <span className="text-red-600 font-bold text-sm">Expired</span>;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold
      ${isUrgent ? "bg-red-100 text-red-700 animate-pulse" : "bg-amber-100 text-amber-700"}`}>
      <Clock className="h-3.5 w-3.5" />
      <span className="font-mono">{remaining || "..."}</span>
    </div>
  );
}

const PROVIDER_CONFIG: Record<string, { icon: string; label: string; desc: string; gradient: string; border: string; ring: string }> = {
  STRIPE: {
    icon: "💳",
    label: "Credit / Debit Card",
    desc: "Pay securely with Visa, Mastercard, AMEX",
    gradient: "from-indigo-50 to-violet-50",
    border: "border-indigo-300",
    ring: "ring-indigo-400",
  },
  PAYPAL: {
    icon: "🅿️",
    label: "PayPal",
    desc: "Pay with your PayPal account",
    gradient: "from-blue-50 to-sky-50",
    border: "border-blue-300",
    ring: "ring-blue-400",
  },
  PAYOS: {
    icon: "🏦",
    label: "Bank / E-Wallet",
    desc: "Vietnam banks, MoMo, ZaloPay & more",
    gradient: "from-emerald-50 to-teal-50",
    border: "border-emerald-300",
    ring: "ring-emerald-400",
  },
};

export default function ReservationDetailPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const router = useRouter();
  const { data: reservation, isLoading } = useReservation(reservationId);
  const cancelMutation = useCancelReservation();
  const refundMutation = useRefundPayment();
  const payMutation = useInitiatePayment();
  const validateCouponMutation = useValidateCoupon();
  const applyCouponMutation = useApplyCoupon();
  const removeCouponMutation = useRemoveCoupon();
  const { data: paymentInfo } = usePaymentStatus(
    reservation?.status === "CONFIRMED" ? reservationId : undefined
  );
  const { data: providers, isLoading: providersLoading } = usePaymentProviders();

  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [couponCode, setCouponCode] = useState("");

  useEffect(() => {
    if (providers?.length && !selectedProvider) {
      setSelectedProvider(providers[0].provider);
    }
  }, [providers, selectedProvider]);

  const handlePay = () => {
    if (!selectedProvider) return;
    payMutation.mutate(
      { reservationId, provider: selectedProvider },
      {
        onSuccess: (data) => {
          setPaymentInitiated(true);
          if (selectedProvider === "PAYPAL" && data.approvalUrl) {
            window.location.href = data.approvalUrl;
            return;
          }
          if (selectedProvider === "PAYOS" && data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
            return;
          }
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-7 w-48" />
        <Card className="border-0 shadow-sm"><CardContent className="py-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="py-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-lg font-semibold">Reservation not found</p>
        <Link href="/reservations"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Back to Tickets</Button></Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[reservation.status];
  const StatusIcon = statusCfg.icon;

  return (
    <div className="max-w-2xl space-y-5">
      {/* Back */}
      <Link href="/reservations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Tickets
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{reservation.eventName}</h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">#{reservation.id.slice(0, 8)}</p>
        </div>
        <Badge variant={statusCfg.variant} className="text-xs px-3 py-1.5 flex items-center gap-1.5">
          <StatusIcon className="h-3 w-3" />
          {reservation.status}
        </Badge>
      </div>

      {/* Timer bar for pending */}
      {reservation.expiresAt && reservation.status === "PENDING" && (
        <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Clock className="h-4 w-4" />
            <span className="font-medium">Complete payment before time expires</span>
          </div>
          <CountdownTimer expiresAt={reservation.expiresAt} />
        </div>
      )}

      {/* Order Summary */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Order Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {reservation.items?.length ? (
            <div className="space-y-3">
              {reservation.items.map((item, idx) => (
                <div key={item.id ?? `${item.tierName}-${item.seatLabel}-${idx}`} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/5 rounded-lg flex items-center justify-center text-xs font-bold text-primary">
                      {item.tierName.slice(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{item.tierName}</p>
                      {item.seatLabel && (
                        <p className="text-xs text-muted-foreground">Seat {item.seatLabel}</p>
                      )}
                    </div>
                  </div>
                  <p className="font-bold text-sm">${item.priceAtBooking.toFixed(2)}</p>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{reservation.ticketCount} ticket(s)</span>
                <span className="text-xl font-extrabold">${reservation.totalAmount.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{reservation.currency}</span></span>
              </div>
              {/* Show discount if coupon applied */}
              {reservation.couponCode && reservation.discountAmount && reservation.discountAmount > 0 && (
                <>
                  <div className="flex justify-between items-center text-green-600">
                    <span className="text-sm flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" />
                      Coupon: {reservation.couponCode}
                    </span>
                    <span className="text-sm font-bold">-${reservation.discountAmount.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Total to pay</span>
                    <span className="text-xl font-extrabold text-primary">
                      ${(reservation.finalAmount ?? reservation.totalAmount - reservation.discountAmount).toFixed(2)}
                      <span className="text-xs font-normal text-muted-foreground ml-1">{reservation.currency}</span>
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground text-sm">No ticket details available</p>
              <div className="flex justify-between mt-3 pt-3 border-t">
                <span className="text-sm text-muted-foreground">{reservation.ticketCount} ticket(s)</span>
                <span className="text-xl font-extrabold">${reservation.totalAmount.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{reservation.currency}</span></span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coupon Section */}
      {reservation.status === "PENDING" && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Discount Code</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {reservation.couponCode ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="font-bold text-sm text-green-800">{reservation.couponCode}</p>
                    <p className="text-xs text-green-600">
                      Saving ${reservation.discountAmount?.toFixed(2) ?? "0.00"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                  onClick={() => removeCouponMutation.mutate(reservationId)}
                  disabled={removeCouponMutation.isPending}
                >
                  {removeCouponMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 font-mono uppercase"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && couponCode.trim()) {
                        validateCouponMutation.mutate({ reservationId, couponCode: couponCode.trim() });
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (couponCode.trim()) {
                        validateCouponMutation.mutate({ reservationId, couponCode: couponCode.trim() });
                      }
                    }}
                    disabled={!couponCode.trim() || validateCouponMutation.isPending}
                    className="shrink-0"
                  >
                    {validateCouponMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Check"
                    )}
                  </Button>
                </div>

                {/* Validation preview */}
                {validateCouponMutation.data && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-800">{validateCouponMutation.data.message}</span>
                    </div>
                    <div className="text-xs text-green-700 space-y-0.5">
                      <p>Original: ${validateCouponMutation.data.originalAmount.toFixed(2)}</p>
                      <p>Discount: -${validateCouponMutation.data.discountAmount.toFixed(2)}</p>
                      <p className="font-bold">You pay: ${validateCouponMutation.data.finalAmount.toFixed(2)}</p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-1"
                      onClick={() => {
                        applyCouponMutation.mutate(
                          { reservationId, couponCode: couponCode.trim() },
                          { onSuccess: () => { setCouponCode(""); validateCouponMutation.reset(); } }
                        );
                      }}
                      disabled={applyCouponMutation.isPending}
                    >
                      {applyCouponMutation.isPending ? (
                        <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying...</span>
                      ) : (
                        <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Apply Coupon</span>
                      )}
                    </Button>
                  </div>
                )}

                {/* Error */}
                {validateCouponMutation.isError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm text-red-700">Invalid or expired coupon code</span>
                  </div>
                )}
                {applyCouponMutation.isError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm text-red-700">Failed to apply coupon. Please try again.</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Section */}
      {reservation.status === "PENDING" && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Payment</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {paymentInitiated && payMutation.data ? (
              <div className="space-y-3">
                {/* Stripe: real card form */}
                {payMutation.data.clientSecret && (
                  <StripeCheckout
                    clientSecret={payMutation.data.clientSecret}
                    amount={reservation.finalAmount ?? reservation.totalAmount}
                    currency={reservation.currency}
                    reservationId={reservationId}
                    onSuccess={() => router.push("/reservations")}
                  />
                )}

                {/* Redirect */}
                {(payMutation.data.approvalUrl || payMutation.data.checkoutUrl) && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-5 rounded-xl text-center space-y-3">
                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
                    <p className="text-blue-700 font-bold">Redirecting to payment provider...</p>
                    <p className="text-xs text-muted-foreground">You will be redirected shortly to complete your payment.</p>
                    <a
                      href={payMutation.data.approvalUrl || payMutation.data.checkoutUrl}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                    >
                      Click here if not redirected <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Provider Selection */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Select payment method</p>
                  {providersLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full rounded-xl" />
                      <Skeleton className="h-16 w-full rounded-xl" />
                    </div>
                  ) : providers?.length ? (
                    <div className="grid gap-2.5">
                      {providers.map((p) => {
                        const cfg = PROVIDER_CONFIG[p.provider] || {
                          icon: "💰", label: p.displayName, desc: "Pay online",
                          gradient: "from-gray-50 to-gray-50", border: "border-gray-300", ring: "ring-gray-400",
                        };
                        const isSelected = selectedProvider === p.provider;
                        return (
                          <button
                            key={p.provider}
                            onClick={() => setSelectedProvider(p.provider)}
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left
                              ${isSelected
                                ? `bg-gradient-to-r ${cfg.gradient} ${cfg.border} ring-2 ring-offset-1 ${cfg.ring} shadow-sm`
                                : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                              }`}
                          >
                            <span className="text-3xl">{cfg.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm">{cfg.label}</p>
                              <p className="text-xs text-muted-foreground truncate">{cfg.desc}</p>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-sm text-red-700">
                      No payment providers available. Please try again later.
                    </div>
                  )}
                </div>

                {/* Pay Button */}
                <Button
                  onClick={handlePay}
                  disabled={payMutation.isPending || !selectedProvider}
                  className="w-full h-13 text-base font-bold shadow-lg hover:shadow-xl transition-all"
                  size="lg"
                >
                  {payMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Pay ${(reservation.finalAmount ?? reservation.totalAmount).toFixed(2)} {reservation.currency}
                    </span>
                  )}
                </Button>

                {/* Security note */}
                <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                  <Shield className="h-3 w-3" /> Secure payment · SSL encrypted · PCI compliant
                </p>
              </>
            )}

            {payMutation.isError && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-700 text-sm font-bold">Payment failed</p>
                  <p className="text-red-600 text-xs mt-0.5">Please try again or choose a different payment method.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmed payment info */}
      {reservation.status === "CONFIRMED" && paymentInfo && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-green-50/50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <CardTitle className="text-base text-green-800">Payment Confirmed</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="default" className="w-fit">{paymentInfo.status}</Badge>
              <span className="text-muted-foreground">Amount</span>
              <span className="font-bold">${paymentInfo.amount?.toFixed(2)} {paymentInfo.currency?.toUpperCase()}</span>
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium capitalize">{paymentInfo.provider}</span>
              {paymentInfo.completedAt && (
                <>
                  <span className="text-muted-foreground">Paid at</span>
                  <span>{formatDate(paymentInfo.completedAt)}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Booking info */}
      <div className="text-xs text-muted-foreground space-y-1 px-1">
        <p>Booked: {formatDate(reservation.createdAt)}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Link href="/reservations">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Tickets
          </Button>
        </Link>
        {reservation.status === "PENDING" && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              cancelMutation.mutate(reservation.id, {
                onSuccess: () => router.push("/reservations"),
              });
            }}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? (
              <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cancelling...</span>
            ) : (
              <span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" /> Cancel Reservation</span>
            )}
          </Button>
        )}
        {reservation.status === "CONFIRMED" && paymentInfo?.status === "COMPLETED" && (
          <Button
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => {
              if (confirm("Are you sure you want to request a refund? This action cannot be undone.")) {
                refundMutation.mutate(reservation.id);
              }
            }}
            disabled={refundMutation.isPending}
          >
            {refundMutation.isPending ? (
              <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Refunding...</span>
            ) : (
              <span className="flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5" /> Request Refund</span>
            )}
          </Button>
        )}
        {refundMutation.isSuccess && (
          <div className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Refund initiated successfully
          </div>
        )}
        {refundMutation.isError && (
          <div className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" /> Refund failed. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}
