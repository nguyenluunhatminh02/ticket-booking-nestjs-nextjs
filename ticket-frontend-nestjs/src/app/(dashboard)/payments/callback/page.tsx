"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Ticket } from "lucide-react";
import Link from "next/link";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const provider = searchParams.get("provider") ?? "unknown";
  const status = searchParams.get("status");
  const reservationId = searchParams.get("reservationId");
  const error = searchParams.get("error");

  const [countdown, setCountdown] = useState(5);

  const isSuccess =
    status === "COMPLETED" || status === "PROCESSING" || status === "succeeded";
  const isFailed = status === "FAILED" || !!error;
  const isLoading = !status && !error;

  useEffect(() => {
    if (!isSuccess) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (reservationId) {
            router.push(`/reservations/${reservationId}`);
          } else {
            router.push("/reservations");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isSuccess, reservationId, router]);

  const providerName =
    {
      paypal: "PayPal",
      stripe: "Stripe",
      payos: "PayOS",
    }[provider.toLowerCase()] ?? provider;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
            <h2 className="text-xl font-bold">Processing Payment</h2>
            <p className="text-sm text-muted-foreground">
              Please wait while we confirm your payment with {providerName}...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md border-0 shadow-lg overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-green-400 to-emerald-500" />
          <CardContent className="py-12 text-center space-y-5">
            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-green-700">
                Payment Successful!
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Your payment via {providerName} has been confirmed.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Redirecting to your tickets in {countdown}s...
            </p>
            <div className="flex gap-3 justify-center pt-2">
              {reservationId && (
                <Link href={`/reservations/${reservationId}`}>
                  <Button size="sm">
                    <Ticket className="h-4 w-4 mr-1.5" />
                    View Ticket
                  </Button>
                </Link>
              )}
              <Link href="/reservations">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  All Tickets
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md border-0 shadow-lg overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-red-400 to-rose-500" />
          <CardContent className="py-12 text-center space-y-5">
            <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-red-700">
                Payment Failed
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {error ||
                  `Your payment via ${providerName} could not be completed.`}
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <Link href="/reservations">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back to Tickets
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
