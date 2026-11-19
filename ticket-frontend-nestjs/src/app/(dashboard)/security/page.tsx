"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { ConnectedAccounts } from "@/components/auth/connected-accounts";
import { useLoginHistory, useSecurityEvents } from "@/hooks/use-auth";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

export default function SecurityPage() {
  const [historyPage, setHistoryPage] = useState(0);
  const [eventsPage, setEventsPage] = useState(0);
  const loginHistory = useLoginHistory(historyPage);
  const securityEvents = useSecurityEvents(eventsPage);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Security</h1>

      <ChangePasswordForm />

      <ConnectedAccounts />

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Login History</TabsTrigger>
          <TabsTrigger value="events">Security Events</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Login History</CardTitle>
              <CardDescription>Recent login attempts to your account</CardDescription>
            </CardHeader>
            <CardContent>
              {loginHistory.isLoading ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : loginHistory.data?.content.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No login history found.</p>
              ) : (
                <div className="space-y-3">
                  {loginHistory.data?.content.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between border rounded-md p-3">
                      <div className="flex items-center gap-3">
                        {entry.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{entry.ipAddress}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{entry.deviceInfo}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <Badge variant={entry.success ? "default" : "destructive"} className="text-xs">
                          {entry.success ? "Success" : "Failed"}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(entry.attemptedAt)}</p>
                      </div>
                    </div>
                  ))}
                  {loginHistory.data && loginHistory.data.totalPages > 1 && (
                    <div className="flex justify-center gap-2 pt-4">
                      <button
                        onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                        disabled={loginHistory.data.first}
                        className="text-sm text-primary disabled:text-muted-foreground"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-muted-foreground">
                        Page {loginHistory.data.number + 1} of {loginHistory.data.totalPages}
                      </span>
                      <button
                        onClick={() => setHistoryPage((p) => p + 1)}
                        disabled={loginHistory.data.last}
                        className="text-sm text-primary disabled:text-muted-foreground"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Security Events</CardTitle>
              <CardDescription>Important security-related activities</CardDescription>
            </CardHeader>
            <CardContent>
              {securityEvents.isLoading ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : securityEvents.data?.content.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No security events found.</p>
              ) : (
                <div className="space-y-3">
                  {securityEvents.data?.content.map((event) => (
                    <div key={event.id} className="flex items-center justify-between border rounded-md p-3">
                      <div>
                        <p className="text-sm font-medium">{event.action}</p>
                        <p className="text-xs text-muted-foreground">{event.ipAddress}</p>
                        {event.details && <p className="text-xs text-muted-foreground truncate max-w-xs">{event.details}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <Badge variant={event.success ? "default" : "destructive"} className="text-xs">
                          {event.success ? "OK" : "Failed"}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(event.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                  {securityEvents.data && securityEvents.data.totalPages > 1 && (
                    <div className="flex justify-center gap-2 pt-4">
                      <button
                        onClick={() => setEventsPage((p) => Math.max(0, p - 1))}
                        disabled={securityEvents.data.first}
                        className="text-sm text-primary disabled:text-muted-foreground"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-muted-foreground">
                        Page {securityEvents.data.number + 1} of {securityEvents.data.totalPages}
                      </span>
                      <button
                        onClick={() => setEventsPage((p) => p + 1)}
                        disabled={securityEvents.data.last}
                        className="text-sm text-primary disabled:text-muted-foreground"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
