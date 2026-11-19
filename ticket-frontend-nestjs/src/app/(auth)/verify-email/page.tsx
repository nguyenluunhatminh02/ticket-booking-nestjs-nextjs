"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useVerifyEmail } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { data, isLoading, isError, error } = useVerifyEmail(token);

  if (!token) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader><CardTitle>Invalid Link</CardTitle></CardHeader>
        <CardContent>
          <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">No verification token provided.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-10">
          <Loader2 className="h-16 w-16 text-primary mx-auto animate-spin mb-4" />
          <p className="text-muted-foreground">Verifying your email...</p>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader><CardTitle>Verification Failed</CardTitle></CardHeader>
        <CardContent>
          <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{(error as Error)?.message || "Token is invalid or expired."}</p>
          <Button asChild><Link href="/login">Go to Login</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader><CardTitle>Email Verified!</CardTitle></CardHeader>
      <CardContent>
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <p className="text-muted-foreground mb-4">{data?.message || "Your email has been verified successfully."}</p>
        <Button asChild><Link href="/login">Sign In</Link></Button>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
