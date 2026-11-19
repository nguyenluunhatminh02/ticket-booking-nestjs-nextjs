"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, CheckCircle2, AlertTriangle } from "lucide-react";
import apiClient from "@/lib/api-client";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

function CheckoutForm({
  amount,
  currency,
  reservationId,
  onSuccess,
}: {
  amount: number;
  currency: string;
  reservationId: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [elementReady, setElementReady] = useState(false);
  const [pendingIntentId, setPendingIntentId] = useState<string | null>(null);

  const confirmWithBackend = async (intentId: string) => {
    await apiClient.post("/payments/confirm-stripe", {
      paymentIntentId: intentId,
      reservationId,
    });
    setPendingIntentId(null);
    setSucceeded(true);
    onSuccess();
  };

  const retryConfirmation = async () => {
    if (!pendingIntentId) return;
    setLoading(true);
    setError(null);
    try {
      await confirmWithBackend(pendingIntentId);
    } catch {
      setError("Ticket confirmation is still failing. Your payment was received — please retry or contact support.");
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Validation failed");
      setLoading(false);
      return;
    }

    const { error: confirmError, paymentIntent } =
      await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payments/callback?provider=stripe`,
        },
        redirect: "if_required",
      });

    if (confirmError) {
      // Handle specific error types
      if (confirmError.code === "card_declined") {
        const declineCode = confirmError.decline_code;
        if (declineCode === "insufficient_funds") {
          setError("Your card has insufficient funds. Please use a different card or add funds.");
        } else {
          setError(confirmError.message ?? "Your card was declined. Please try another card.");
        }
      } else if (confirmError.type === "card_error") {
        setError(confirmError.message ?? "Card error. Please check your card details.");
      } else {
        setError(confirmError.message ?? "Payment failed. Please try again.");
      }
      setLoading(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      try {
        await confirmWithBackend(paymentIntent.id);
      } catch {
        setPendingIntentId(paymentIntent.id);
        setError("Payment was charged but ticket confirmation failed. Please retry confirmation below.");
      }
    } else if (paymentIntent?.status === "requires_action") {
      setError("Additional authentication required. Please complete the verification.");
    } else {
      setError("Payment was not completed. Please try again.");
    }
    setLoading(false);
  };

  if (succeeded) {
    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-6 rounded-xl text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
        <p className="text-green-700 font-bold text-lg">Payment Successful!</p>
        <p className="text-sm text-muted-foreground">
          Your tickets have been confirmed.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
          onReady={() => setElementReady(true)}
          onLoadError={() => {
            setError("Failed to load payment form. Please refresh and try again.");
          }}
        />
        {!elementReady && (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading payment form...
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {pendingIntentId && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={retryConfirmation}
        >
          {loading ? "Retrying..." : "Retry ticket confirmation"}
        </Button>
      )}

      <Button
        type="submit"
        disabled={loading || !stripe || !elements || !elementReady}
        className="w-full h-13 text-base font-bold shadow-lg hover:shadow-xl transition-all"
        size="lg"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Processing...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Pay ${amount.toFixed(2)} {currency.toUpperCase()}
          </span>
        )}
      </Button>

      <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1">
        <Shield className="h-3 w-3" /> Secure payment · SSL encrypted · PCI
        compliant
      </p>
    </form>
  );
}

export function StripeCheckout({
  clientSecret,
  amount,
  currency,
  reservationId,
  onSuccess,
}: {
  clientSecret: string;
  amount: number;
  currency: string;
  reservationId: string;
  onSuccess: () => void;
}) {
  if (!stripePromise) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-center">
        <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 text-sm font-medium">Stripe is not configured. Please try another payment method.</p>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#4f46e5",
            borderRadius: "8px",
            fontFamily: "inherit",
          },
        },
      }}
    >
      <CheckoutForm
        amount={amount}
        currency={currency}
        reservationId={reservationId}
        onSuccess={onSuccess}
      />
    </Elements>
  );
}
