import { Button } from "@/components/ui/button";
import { Search, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md space-y-5">
        <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
          <Search className="h-10 w-10 text-gray-400" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold">Page Not Found</h2>
          <p className="text-sm text-muted-foreground mt-2">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Link href="/events">
            <Button variant="default" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Browse Events
            </Button>
          </Link>
          <Link href="/reservations">
            <Button variant="outline" size="sm">
              My Tickets
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
