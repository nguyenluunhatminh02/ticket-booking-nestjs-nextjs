"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Auth Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md border-0 shadow-lg overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-red-400 to-rose-500" />
        <CardContent className="py-10 text-center space-y-5">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Please try again or return to the login page.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={reset} size="sm">
              <RotateCcw className="h-4 w-4 mr-1.5" /> Try Again
            </Button>
            <Link href="/login">
              <Button variant="outline" size="sm">
                Back to Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
