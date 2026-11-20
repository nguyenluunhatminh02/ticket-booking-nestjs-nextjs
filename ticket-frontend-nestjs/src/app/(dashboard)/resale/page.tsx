"use client";

import { useState } from "react";
import {
  useMarketplaceListings,
  useMyResaleListings,
  useLockResaleListing,
  usePurchaseResaleListing,
  useCancelResaleListing,
} from "@/hooks/use-resale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Ticket,
  ShoppingCart,
  Tag,
  Clock,
  CreditCard,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Store,
  DollarSign,
  Lock,
  XCircle,
  CheckCircle2,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";
import type { ResaleListingResponse, ResaleStatus } from "@/types/booking";
import { getErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";

type Tab = "marketplace" | "my-listings";

const STATUS_VARIANT: Record<ResaleStatus, "default" | "secondary" | "destructive" | "outline"> = {
  LISTED: "default",
  LOCKED: "secondary",
  SOLD: "outline",
  CANCELLED: "destructive",
  EXPIRED: "outline",
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

function formatPrice(amount?: number, currency?: string) {
  if (amount == null) return "";
  return `$${amount.toFixed(2)}${currency ? ` ${currency}` : ""}`;
}

function ListingCard({
  listing,
  variant,
  onLock,
  onPurchase,
  onCancel,
  isActing,
}: {
  listing: ResaleListingResponse;
  variant: Tab;
  onLock?: (id: string) => void;
  onPurchase?: (id: string, paymentIntentId: string) => void;
  onCancel?: (id: string) => void;
  isActing: boolean;
}) {
  const { t } = useTranslation();
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const discount = listing.originalPrice > 0
    ? Math.round(((listing.askingPrice - listing.originalPrice) / listing.originalPrice) * 100)
    : 0;

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="py-5">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Ticket className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg">{listing.eventName}</h3>
              <Badge variant={STATUS_VARIANT[listing.status]}>{listing.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(listing.eventDate)}
              </div>
              {listing.venueName && (
                <div className="flex items-center gap-1">
                  <Store className="h-3.5 w-3.5" /> {listing.venueName}
                </div>
              )}
              <div>
                {t("tickets.tier")}:{" "}
                <span className="font-medium text-foreground">{listing.tierName}</span>
              </div>
              {listing.seatLabel && (
                <div>
                  {t("tickets.seat")}:{" "}
                  <span className="font-medium text-foreground">{listing.seatLabel}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3">
              <div>
                <p className="text-xl font-extrabold text-primary">
                  {formatPrice(listing.askingPrice, listing.currency)}
                </p>
                {listing.originalPrice !== listing.askingPrice && (
                  <p className="text-xs text-muted-foreground line-through">
                    {formatPrice(listing.originalPrice, listing.currency)}
                  </p>
                )}
              </div>
              {discount !== 0 && (
                <Badge variant={discount > 0 ? "destructive" : "default"} className="text-xs">
                  {discount > 0 ? `+${discount}%` : `${discount}%`}
                </Badge>
              )}
              {listing.platformFeeAmount != null && listing.platformFeeAmount > 0 && (
                <span className="text-xs text-muted-foreground">
                  Fee: {formatPrice(listing.platformFeeAmount, listing.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 items-end justify-center">
            {variant === "marketplace" && listing.status === "LISTED" && (
              <>
                <Button
                  size="sm"
                  disabled={isActing}
                  onClick={() => onLock?.(listing.id)}
                  className="w-full sm:w-auto"
                >
                  {isActing ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4 mr-1" />
                  )}
                  Reserve
                </Button>
              </>
            )}
            {variant === "marketplace" && listing.status === "LOCKED" && (
              <div className="w-full sm:w-auto space-y-2">
                {showPaymentInput && (
                  <div className="space-y-1">
                    <label
                      htmlFor={`payment-intent-${listing.id}`}
                      className="text-xs text-muted-foreground flex items-center gap-1"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Stripe PaymentIntent ID
                    </label>
                    <Input
                      id={`payment-intent-${listing.id}`}
                      value={paymentIntentId}
                      onChange={(event) => setPaymentIntentId(event.target.value)}
                      placeholder="pi_..."
                      disabled={isActing}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {!showPaymentInput ? (
                  <Button
                    size="sm"
                    disabled={isActing}
                    onClick={() => setShowPaymentInput(true)}
                    className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                  >
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    Complete Purchase
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isActing}
                      onClick={() => {
                        setShowPaymentInput(false);
                        setPaymentIntentId("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={isActing || !paymentIntentId.trim()}
                      onClick={() => onPurchase?.(listing.id, paymentIntentId.trim())}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isActing ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-4 w-4 mr-1" />
                      )}
                      Confirm
                    </Button>
                  </div>
                )}
              </div>
            )}
            {variant === "my-listings" && listing.status === "LISTED" && (
              <Button
                variant="destructive"
                size="sm"
                disabled={isActing}
                onClick={() => onCancel?.(listing.id)}
              >
                {isActing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-1" />
                )}
                Cancel Listing
              </Button>
            )}
            {listing.status === "SOLD" && (
              <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" /> Sold
              </div>
            )}
            {listing.lockExpiresAt && listing.status === "LOCKED" && (
              <p className="text-xs text-muted-foreground">
                Lock expires: {formatDate(listing.lockExpiresAt)}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResaleMarketplacePage() {
  const [tab, setTab] = useState<Tab>("marketplace");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const marketplace = useMarketplaceListings(undefined, page, 20);
  const myListings = useMyResaleListings(page, 20);
  const lockMutation = useLockResaleListing();
  const purchaseMutation = usePurchaseResaleListing();
  const cancelMutation = useCancelResaleListing();

  const data = tab === "marketplace" ? marketplace.data : myListings.data;
  const isLoading = tab === "marketplace" ? marketplace.isLoading : myListings.isLoading;
  const isActing = lockMutation.isPending || purchaseMutation.isPending || cancelMutation.isPending;

  const handleAction = async (action: (id: string) => Promise<unknown>, id: string) => {
    setError(null);
    try {
      await action(id);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleLock = (id: string) => handleAction((i) => lockMutation.mutateAsync(i), id);
  const handlePurchase = (id: string, paymentIntentId: string) =>
    handleAction(() => purchaseMutation.mutateAsync({ listingId: id, paymentIntentId }), id);
  const handleCancel = (id: string) => handleAction((i) => cancelMutation.mutateAsync(i), id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-primary" />
          Resale Marketplace
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Buy and sell tickets from other attendees at fair prices
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted rounded-lg p-1 w-fit">
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "marketplace"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => {
            setTab("marketplace");
            setPage(0);
          }}
        >
          <Store className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Marketplace
        </button>
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "my-listings"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => {
            setTab("my-listings");
            setPage(0);
          }}
        >
          <Tag className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          My Listings
        </button>
      </div>

      {error && (
        <Alert variant="destructive" className="animate-in slide-in-from-top-1">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="py-5">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!data?.content || data.content.length === 0) && (
        <div className="text-center py-20">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            {tab === "marketplace" ? (
              <Store className="h-7 w-7 text-primary" />
            ) : (
              <Tag className="h-7 w-7 text-primary" />
            )}
          </div>
          <p className="text-lg font-semibold">
            {tab === "marketplace" ? "No listings available" : "You haven't listed any tickets"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === "marketplace"
              ? "Check back later for resale tickets."
              : "Go to your tickets to list one for resale."}
          </p>
        </div>
      )}

      {/* Listings */}
      {!isLoading && data?.content && data.content.length > 0 && (
        <div className="space-y-4">
          {data.content.map((listing: ResaleListingResponse) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              variant={tab}
              onLock={handleLock}
              onPurchase={handlePurchase}
              onCancel={handleCancel}
              isActing={isActing}
            />
          ))}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={data.first}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                {t("common.page")} {data.number + 1} {t("common.of")} {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={data.last}
                onClick={() => setPage((p) => p + 1)}
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
