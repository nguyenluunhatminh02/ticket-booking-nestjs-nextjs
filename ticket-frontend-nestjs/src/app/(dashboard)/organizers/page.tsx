"use client";

import { useOrganizers } from "@/hooks/use-organizers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Globe, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function OrganizersPage() {
  const { data, isLoading } = useOrganizers();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Organizers</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="py-5">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const organizers = data?.content ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Organizers</h1>
        <p className="text-muted-foreground text-sm mt-1">Discover event organizers</p>
      </div>

      {!organizers.length ? (
        <p className="text-center text-muted-foreground py-12">No organizers found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {organizers.map((org) => (
            <Link key={org.id} href={`/organizers/${org.id}`}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {org.logoUrl ? (
                        <img src={org.logoUrl} alt={org.name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <Users className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold truncate">{org.name}</h3>
                        {org.verified && (
                          <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                      {org.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{org.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{org.followerCount} followers</span>
                        {org.website && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" /> Website
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
