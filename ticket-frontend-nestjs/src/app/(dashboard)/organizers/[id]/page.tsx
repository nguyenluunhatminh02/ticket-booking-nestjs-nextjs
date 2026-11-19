"use client";

import { useParams } from "next/navigation";
import { useOrganizer, useFollowOrganizer, useUnfollowOrganizer } from "@/hooks/use-organizers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Globe, Mail, Phone, CheckCircle, Heart, HeartOff } from "lucide-react";

export default function OrganizerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: org, isLoading } = useOrganizer(id);
  const followMutation = useFollowOrganizer();
  const unfollowMutation = useUnfollowOrganizer();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!org) return <p>Organizer not found.</p>;

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardContent className="py-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <Users className="h-10 w-10 text-primary" />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h1 className="text-2xl font-extrabold">{org.name}</h1>
                {org.verified && <CheckCircle className="h-5 w-5 text-blue-600" />}
              </div>
              {org.description && <p className="text-muted-foreground mt-2">{org.description}</p>}
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground justify-center sm:justify-start">
                <span className="font-medium">{org.followerCount} followers</span>
                {org.website && (
                  <a href={org.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline">
                    <Globe className="h-4 w-4" /> Website
                  </a>
                )}
                {org.contactEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" /> {org.contactEmail}
                  </span>
                )}
                {org.contactPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" /> {org.contactPhone}
                  </span>
                )}
              </div>
            </div>
            <div>
              {org.following ? (
                <Button
                  variant="outline"
                  onClick={() => unfollowMutation.mutate(id)}
                  disabled={unfollowMutation.isPending}
                >
                  <HeartOff className="h-4 w-4 mr-1" /> Unfollow
                </Button>
              ) : (
                <Button
                  onClick={() => followMutation.mutate(id)}
                  disabled={followMutation.isPending}
                >
                  <Heart className="h-4 w-4 mr-1" /> Follow
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
