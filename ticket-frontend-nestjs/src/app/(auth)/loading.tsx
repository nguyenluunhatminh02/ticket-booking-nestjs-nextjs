import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Loading...</p>
        </CardContent>
      </Card>
    </div>
  );
}
