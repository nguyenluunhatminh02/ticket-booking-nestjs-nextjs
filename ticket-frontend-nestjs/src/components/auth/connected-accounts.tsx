"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnectedAccounts, useDisconnectOAuth } from "@/hooks/use-auth";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { Unlink } from "lucide-react";

const providerIcons: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  microsoft: "Microsoft",
};

export function ConnectedAccounts() {
  const { data: accounts, isLoading } = useConnectedAccounts();
  const disconnectMutation = useDisconnectOAuth();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Accounts</CardTitle>
        <CardDescription>
          Manage your linked social login accounts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : accounts && accounts.length > 0 ? (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between border rounded-md p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="capitalize">
                    {providerIcons[account.provider] || account.provider}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{account.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.name}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnectMutation.mutate(account.provider)}
                  disabled={disconnectMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Unlink className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No accounts connected yet.
          </p>
        )}

        <div className="pt-2">
          <p className="text-sm text-muted-foreground mb-3">
            Connect a new account:
          </p>
          <SocialLoginButtons />
        </div>
      </CardContent>
    </Card>
  );
}
