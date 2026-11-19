"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md space-y-5">
        <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mt-2">
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="default" size="sm">
            <RotateCcw className="h-4 w-4 mr-1.5" /> Try Again
          </Button>
          <Link href="/events">
            <Button variant="outline" size="sm">
              <Home className="h-4 w-4 mr-1.5" /> Back to Events
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
