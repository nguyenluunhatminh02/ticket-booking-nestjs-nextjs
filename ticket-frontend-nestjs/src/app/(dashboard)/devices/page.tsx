"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDevices,
  useActiveSessions,
  useDeactivateDevice,
  useDeactivateOtherDevices,
  useTrustDevice,
  useUntrustDevice,
  useRenameDevice,
} from "@/hooks/use-devices";
import { formatDate } from "@/lib/utils";
import { Smartphone, Monitor, Tablet, Trash2, Shield, ShieldOff, Pencil, Loader2 } from "lucide-react";
import { useState } from "react";

function DeviceIcon({ type }: { type: string }) {
  switch (type?.toUpperCase()) {
    case "MOBILE":
      return <Smartphone className="h-8 w-8 text-muted-foreground" />;
    case "TABLET":
      return <Tablet className="h-8 w-8 text-muted-foreground" />;
    default:
      return <Monitor className="h-8 w-8 text-muted-foreground" />;
  }
}

export default function DevicesPage() {
  const { data: devices, isLoading } = useDevices();
  const sessions = useActiveSessions();
  const deactivateDevice = useDeactivateDevice();
  const deactivateOthers = useDeactivateOtherDevices();
  const trustDevice = useTrustDevice();
  const untrustDevice = useUntrustDevice();
  const renameDevice = useRenameDevice();
  const [renameId, setRenameId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const handleRename = () => {
    if (renameId && newName.trim()) {
      renameDevice.mutate({ deviceId: renameId, data: { deviceName: newName.trim() } });
      setRenameId(null);
      setNewName("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Devices</h1>
        {sessions.data && (
          <Badge variant="outline">
            {sessions.data.activeSessionCount} / {sessions.data.maxDevices} devices
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active Devices</CardTitle>
            <CardDescription>Manage devices that have access to your account</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => deactivateOthers.mutate()}
            disabled={deactivateOthers.isPending}
          >
            {deactivateOthers.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Remove Others
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : !devices || devices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No active devices found.</p>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <div key={device.id} className="flex items-start gap-4 border rounded-lg p-4">
                  <DeviceIcon type={device.deviceType} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{device.deviceName}</p>
                      {device.current && <Badge className="text-xs">Current</Badge>}
                      {device.trusted && <Badge variant="secondary" className="text-xs">Trusted</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {device.browser} on {device.os}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      IP: {device.ipAddress} &bull; Last active: {formatDate(device.lastActiveAt)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Rename"
                      onClick={() => { setRenameId(device.deviceId); setNewName(device.deviceName); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {device.trusted ? (
                      <Button variant="ghost" size="icon" title="Untrust" onClick={() => untrustDevice.mutate(device.deviceId)}>
                        <ShieldOff className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" title="Trust" onClick={() => trustDevice.mutate(device.deviceId)}>
                        <Shield className="h-4 w-4" />
                      </Button>
                    )}
                    {!device.current && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remove"
                        onClick={() => deactivateDevice.mutate(device.deviceId)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rename Dialog */}
      <Dialog open={!!renameId} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Device</DialogTitle>
            <DialogDescription>Enter a new name for this device.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deviceName">Device Name</Label>
              <Input id="deviceName" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renameDevice.isPending || !newName.trim()}>
              {renameDevice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
