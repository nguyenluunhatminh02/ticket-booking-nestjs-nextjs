"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { mfaVerifySchema, type MfaVerifyFormValues } from "@/schemas/auth";
import { useVerifyMfa } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";

export function MfaVerifyForm() {
  const router = useRouter();
  const verifyMfa = useVerifyMfa();
  const { mfaRequired, clearMfa } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MfaVerifyFormValues>({
    resolver: zodResolver(mfaVerifySchema),
  });

  useEffect(() => {
    inputRef.current?.focus();
    if (!mfaRequired) router.replace("/login");
  }, [mfaRequired, router]);

  const onSubmit = async (data: MfaVerifyFormValues) => {
    await verifyMfa.mutateAsync(data.totpCode);
    router.push("/profile");
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
        <CardDescription>Enter the 6-digit code from your authenticator app</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="totpCode">Verification Code</Label>
            <Input
              id="totpCode"
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              className="text-center text-2xl tracking-[0.5em] font-mono"
              {...register("totpCode")}
              ref={(e) => {
                register("totpCode").ref(e);
                (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
              }}
            />
            {errors.totpCode && <p className="text-sm text-destructive">{errors.totpCode.message}</p>}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            You can also use a backup code if you&apos;ve lost access to your authenticator.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <Button type="submit" className="w-full" disabled={verifyMfa.isPending}>
            {verifyMfa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => { clearMfa(); router.push("/login"); }}>
            Cancel
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
