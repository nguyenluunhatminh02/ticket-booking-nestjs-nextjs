"use client";

import { useState } from "react";
import {
  useAdminCoupons,
  useCreateCoupon,
  useToggleCoupon,
  useDeleteCoupon,
} from "@/hooks/use-booking";
import type { CreateCouponRequest, DiscountType } from "@/types/booking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tag,
  Plus,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Copy,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminCouponsPage() {
  const [page, setPage] = useState(0);
  const { data: coupons, isLoading } = useAdminCoupons(page);
  const createMutation = useCreateCoupon();
  const toggleMutation = useToggleCoupon();
  const deleteMutation = useDeleteCoupon();

  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<CreateCouponRequest>({
    code: "",
    description: "",
    discountType: "PERCENTAGE",
    discountValue: 10,
    maxUses: undefined,
    maxUsesPerUser: 1,
    minPurchaseAmount: undefined,
    maxDiscountAmount: undefined,
    validUntil: undefined,
  });

  const handleCreate = () => {
    const req: CreateCouponRequest = {
      ...form,
      code: form.code.toUpperCase().trim(),
    };
    createMutation.mutate(req, {
      onSuccess: () => {
        setShowForm(false);
        setForm({
          code: "",
          description: "",
          discountType: "PERCENTAGE",
          discountValue: 10,
          maxUses: undefined,
          maxUsesPerUser: 1,
        });
      },
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Coupon Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage discount coupons</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          {showForm ? "Cancel" : <><Plus className="h-4 w-4 mr-1.5" /> New Coupon</>}
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 bg-gray-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" /> Create New Coupon
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Code *</label>
                <Input
                  placeholder="e.g. SUMMER20"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Type *</label>
                <div className="flex gap-2">
                  {(["PERCENTAGE", "FIXED_AMOUNT"] as DiscountType[]).map((type) => (
                    <Button
                      key={type}
                      size="sm"
                      variant={form.discountType === type ? "default" : "outline"}
                      onClick={() => setForm({ ...form, discountType: type })}
                      className="flex-1"
                    >
                      {type === "PERCENTAGE" ? "% Percent" : "$ Fixed"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Discount Value * {form.discountType === "PERCENTAGE" ? "(0-100%)" : "(amount)"}
                </label>
                <Input
                  type="number"
                  placeholder={form.discountType === "PERCENTAGE" ? "10" : "5.00"}
                  value={form.discountValue || ""}
                  onChange={(e) => setForm({ ...form, discountValue: parseFloat(e.target.value) || 0 })}
                  min={0}
                  max={form.discountType === "PERCENTAGE" ? 100 : undefined}
                  step={form.discountType === "PERCENTAGE" ? 1 : 0.01}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <Input
                  placeholder="e.g. Summer sale 20% off"
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Max Total Uses</label>
                <Input
                  type="number"
                  placeholder="Unlimited"
                  value={form.maxUses ?? ""}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value ? parseInt(e.target.value) : undefined })}
                  min={1}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Max Per User</label>
                <Input
                  type="number"
                  placeholder="1"
                  value={form.maxUsesPerUser ?? ""}
                  onChange={(e) => setForm({ ...form, maxUsesPerUser: e.target.value ? parseInt(e.target.value) : undefined })}
                  min={1}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Min Purchase ($)</label>
                <Input
                  type="number"
                  placeholder="No minimum"
                  value={form.minPurchaseAmount ?? ""}
                  onChange={(e) => setForm({ ...form, minPurchaseAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                  min={0}
                  step={0.01}
                />
              </div>
            </div>

            {form.discountType === "PERCENTAGE" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Max Discount Cap ($)</label>
                <Input
                  type="number"
                  placeholder="No cap"
                  value={form.maxDiscountAmount ?? ""}
                  onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                  min={0}
                  step={0.01}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Valid From</label>
                <Input
                  type="datetime-local"
                  value={form.validFrom || ""}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Valid Until</label>
                <Input
                  type="datetime-local"
                  value={form.validUntil || ""}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                />
              </div>
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!form.code.trim() || !form.discountValue || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <span className="flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Creating...</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Plus className="h-4 w-4" /> Create Coupon</span>
                )}
              </Button>
            </div>

            {createMutation.isError && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-700">Failed to create coupon. Code may already exist.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Coupon List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !coupons?.content?.length ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Tag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-semibold">No coupons yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first coupon to offer discounts</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {coupons.content.map((coupon) => (
            <Card key={coupon.id} className={`border-0 shadow-sm transition-opacity ${!coupon.active ? "opacity-60" : ""}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyCode(coupon.code)}
                        className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg transition-colors"
                        title="Click to copy"
                      >
                        <span className="font-mono font-bold text-sm">{coupon.code}</span>
                        {copied === coupon.code ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                      <Badge variant={coupon.active ? "default" : "secondary"}>
                        {coupon.active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">
                        {coupon.discountType === "PERCENTAGE"
                          ? `${coupon.discountValue}% off`
                          : `$${coupon.discountValue.toFixed(2)} off`}
                      </Badge>
                    </div>
                    {coupon.description && (
                      <p className="text-sm text-muted-foreground">{coupon.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Used: {coupon.currentUses}{coupon.maxUses ? `/${coupon.maxUses}` : ""}</span>
                      {coupon.maxUsesPerUser && <span>Max {coupon.maxUsesPerUser}/user</span>}
                      {coupon.minPurchaseAmount && <span>Min ${coupon.minPurchaseAmount.toFixed(2)}</span>}
                      {coupon.maxDiscountAmount && <span>Cap ${coupon.maxDiscountAmount.toFixed(2)}</span>}
                      {coupon.eventName && <span>Event: {coupon.eventName}</span>}
                      <span>From {formatDate(coupon.validFrom)}</span>
                      {coupon.validUntil && <span>Until {formatDate(coupon.validUntil)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => toggleMutation.mutate({ couponId: coupon.id, active: !coupon.active })}
                      disabled={toggleMutation.isPending}
                      title={coupon.active ? "Deactivate" : "Activate"}
                    >
                      {coupon.active ? (
                        <ToggleRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    {coupon.currentUses === 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`Delete coupon "${coupon.code}"?`)) {
                            deleteMutation.mutate(coupon.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {coupons.totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={coupons.first}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                Page {coupons.number + 1} of {coupons.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={coupons.last}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
