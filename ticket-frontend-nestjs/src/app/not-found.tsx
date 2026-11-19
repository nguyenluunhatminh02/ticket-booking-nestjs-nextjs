import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import Link from "next/link";

export default function GlobalNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center max-w-md space-y-5 p-8">
        <p className="text-7xl font-black text-gray-200">404</p>
        <div>
          <h1 className="text-2xl font-extrabold">Page Not Found</h1>
          <p className="text-sm text-muted-foreground mt-2">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
        <Link href="/">
          <Button size="sm">
            <Home className="h-4 w-4 mr-1.5" /> Go Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
