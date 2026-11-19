"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useMfaStatus, useMfaSetup, useMfaConfirm, useMfaDisable, useRegenerateBackupCodes, useBackupCodesCount } from "@/hooks/use-mfa";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mfaSetupConfirmSchema, mfaVerifySchema, type MfaSetupConfirmFormValues, type MfaVerifyFormValues } from "@/schemas/auth";
import { Loader2, ShieldCheck, ShieldOff, Copy, Check, AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { MfaSetupResponse } from "@/types/auth";

export default function MfaPage() {
  const { data: status, isLoading } = useMfaStatus();
  const backupCount = useBackupCodesCount();
  const setupMfa = useMfaSetup();
  const confirmMfa = useMfaConfirm();
  const disableMfa = useMfaDisable();
  const regenCodes = useRegenerateBackupCodes();

  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null);
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    register: regConfirm,
    handleSubmit: handleConfirm,
    formState: { errors: confirmErrors },
  } = useForm<MfaSetupConfirmFormValues>({
    resolver: zodResolver(mfaSetupConfirmSchema),
  });

  const {
    register: regDisable,
    handleSubmit: handleDisable,
    formState: { errors: disableErrors },
  } = useForm<MfaVerifyFormValues>({
    resolver: zodResolver(mfaVerifySchema),
  });

  const {
    register: regRegen,
    handleSubmit: handleRegen,
    formState: { errors: regenErrors },
  } = useForm<MfaVerifyFormValues>({
    resolver: zodResolver(mfaVerifySchema),
  });

  const handleSetup = async () => {
    const data = await setupMfa.mutateAsync();
    setSetupData(data);
  };

  const handleConfirmSetup = async (formData: MfaSetupConfirmFormValues) => {
    await confirmMfa.mutateAsync({ secret: setupData!.secret, totpCode: formData.totpCode });
    setSetupData(null);
  };

  const handleDisableMfa = async (formData: MfaVerifyFormValues) => {
    await disableMfa.mutateAsync(formData.totpCode);
    setDisableOpen(false);
  };

  const handleRegenCodes = async (formData: MfaVerifyFormValues) => {
    const codes = await regenCodes.mutateAsync(formData.totpCode);
    setNewBackupCodes(codes);
    setRegenOpen(false);
  };

  const copyBackupCodes = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {status?.mfaEnabled ? (
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                ) : (
                  <ShieldOff className="h-5 w-5 text-muted-foreground" />
                )}
                MFA Status
              </CardTitle>
              <CardDescription>
                {status?.mfaEnabled
                  ? "Your account is protected with two-factor authentication"
                  : "Add an extra layer of security to your account"}
              </CardDescription>
            </div>
            <Badge variant={status?.mfaEnabled ? "default" : "outline"}>
              {status?.mfaEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {status?.mfaEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Backup codes remaining</span>
                <Badge variant={backupCount.data! > 2 ? "secondary" : "destructive"}>
                  {backupCount.data ?? "—"}
                </Badge>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">Regenerate Backup Codes</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Regenerate Backup Codes</DialogTitle>
                      <DialogDescription>This will invalidate your existing backup codes. Enter your TOTP code to confirm.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRegen(handleRegenCodes)}>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>TOTP Code</Label>
                          <Input maxLength={6} className="text-center font-mono text-lg tracking-widest" {...regRegen("totpCode")} />
                          {regenErrors.totpCode && <p className="text-sm text-destructive">{regenErrors.totpCode.message}</p>}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setRegenOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={regenCodes.isPending}>
                          {regenCodes.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Regenerate
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">Disable MFA</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Disable MFA</DialogTitle>
                      <DialogDescription>This will remove the extra security from your account. Enter your TOTP code.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleDisable(handleDisableMfa)}>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>TOTP Code</Label>
                          <Input maxLength={6} className="text-center font-mono text-lg tracking-widest" {...regDisable("totpCode")} />
                          {disableErrors.totpCode && <p className="text-sm text-destructive">{disableErrors.totpCode.message}</p>}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setDisableOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="destructive" disabled={disableMfa.isPending}>
                          {disableMfa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Disable
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ) : (
            <Button onClick={handleSetup} disabled={setupMfa.isPending}>
              {setupMfa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enable MFA
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Setup Flow */}
      {setupData && (
        <Card>
          <CardHeader>
            <CardTitle>Setup Authenticator</CardTitle>
            <CardDescription>Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setupData.qrCodeImage} alt="QR Code" className="w-48 h-48 border rounded-lg p-2" />
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Or enter this key manually:</p>
              <code className="text-sm bg-muted px-3 py-1 rounded font-mono select-all">
                {setupData.manualEntryKey}
              </code>
            </div>

            <Separator />

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Save your backup codes</AlertTitle>
              <AlertDescription>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {setupData.backupCodes.map((code) => (
                    <code key={code} className="text-xs bg-muted px-2 py-1 rounded font-mono text-center">
                      {code}
                    </code>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => copyBackupCodes(setupData.backupCodes)}
                >
                  {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied ? "Copied!" : "Copy codes"}
                </Button>
              </AlertDescription>
            </Alert>

            <Separator />

            <form onSubmit={handleConfirm(handleConfirmSetup)} className="space-y-4">
              <div className="space-y-2">
                <Label>Enter the 6-digit code from your authenticator</Label>
                <Input
                  maxLength={6}
                  className="text-center font-mono text-xl tracking-[0.5em] max-w-xs mx-auto"
                  {...regConfirm("totpCode")}
                />
                {confirmErrors.totpCode && (
                  <p className="text-sm text-destructive text-center">{confirmErrors.totpCode.message}</p>
                )}
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="outline" type="button" onClick={() => setSetupData(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={confirmMfa.isPending}>
                  {confirmMfa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify & Enable
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Show new backup codes */}
      {newBackupCodes && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-green-700">New Backup Codes</CardTitle>
            <CardDescription>Save these codes. They won&apos;t be shown again.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {newBackupCodes.map((code) => (
                <code key={code} className="text-sm bg-muted px-3 py-2 rounded font-mono text-center">{code}</code>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copyBackupCodes(newBackupCodes)}>
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? "Copied!" : "Copy codes"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setNewBackupCodes(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
