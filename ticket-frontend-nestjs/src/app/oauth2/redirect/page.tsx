"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

function OAuth2RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, setLoading } = useAuthStore();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      setStatus("error");
      setErrorMessage(error);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get("/users/me");
        const u = res.data?.data;
        if (!u?.id) throw new Error("No active session");
        if (cancelled) return;

        setUser({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          username: u.username,
          phoneNumber: u.phoneNumber,
          profilePicture: u.profilePicture,
          roles: u.roles ?? ["ROLE_USER"],
          emailVerified: u.emailVerified,
          mfaEnabled: u.mfaEnabled,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
        });
        setLoading(false);
        setStatus("success");

        const redirect = sessionStorage.getItem("oauth_redirect") || "/profile";
        sessionStorage.removeItem("oauth_redirect");
        const target = redirect.startsWith("/") ? redirect : "/profile";
        setTimeout(() => router.push(target), 1200);
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage("Failed to complete sign-in. Please try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setUser, setLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {status === "loading" && "Signing you in..."}
            {status === "success" && "Welcome!"}
            {status === "error" && "Authentication Failed"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Processing your authentication...</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-muted-foreground">Login successful! Redirecting...</p>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-sm text-destructive text-center">{errorMessage}</p>
              <Button onClick={() => router.push("/login")} className="mt-4">
                Back to Login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OAuth2RedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      }
    >
      <OAuth2RedirectContent />
    </Suspense>
  );
}
