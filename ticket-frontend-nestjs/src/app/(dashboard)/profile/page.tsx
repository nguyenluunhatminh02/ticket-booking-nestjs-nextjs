"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Camera, Trash2, User } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateProfileSchema, deactivateAccountSchema, type UpdateProfileFormValues, type DeactivateAccountFormValues } from "@/schemas/auth";
import { useProfile, useUpdateProfile, useDeactivateAccount, useUploadAvatar, useDeleteAvatar } from "@/hooks/use-user";
import { formatDate } from "@/lib/utils";
import { useState } from "react";

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const deactivate = useDeactivateAccount();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        return;
      }
      uploadAvatar.mutate(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    values: profile
      ? { firstName: profile.firstName, lastName: profile.lastName, phoneNumber: profile.phoneNumber || "", username: profile.username || "" }
      : undefined,
  });

  const {
    register: regDeactivate,
    handleSubmit: handleDeactivate,
    formState: { errors: deactivateErrors },
  } = useForm<DeactivateAccountFormValues>({
    resolver: zodResolver(deactivateAccountSchema),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* Avatar Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload your avatar (max 5MB, JPEG/PNG/GIF/WebP)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative group">
              {profile?.profilePicture ? (
                <img
                  src={profile.profilePicture}
                  alt="Avatar"
                  className="h-24 w-24 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-dashed border-gray-300">
                  <User className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                type="button"
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAvatar.isPending}
                >
                  {uploadAvatar.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Uploading...</>
                  ) : (
                    <><Camera className="h-3.5 w-3.5 mr-1.5" /> Change Photo</>
                  )}
                </Button>
                {profile?.profilePicture && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAvatar.mutate()}
                    disabled={deleteAvatar.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    {deleteAvatar.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <><Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove</>
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPEG, PNG, GIF or WebP. Max 5MB.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your email and account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{profile?.email}</span>
              {profile?.emailVerified ? (
                <Badge variant="default" className="text-xs">Verified</Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">Unverified</Badge>
              )}
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">MFA</span>
            <Badge variant={profile?.mfaEnabled ? "default" : "outline"}>
              {profile?.mfaEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Roles</span>
            <div className="flex gap-1">
              {profile?.roles.map((r) => (
                <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
              ))}
            </div>
          </div>
          {profile?.lastLoginAt && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Login</span>
                <span className="text-sm">{formatDate(profile.lastLoginAt)}</span>
              </div>
            </>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Member Since</span>
            <span className="text-sm">{profile?.createdAt ? formatDate(profile.createdAt) : "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit((d) => updateProfile.mutate(d))}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" {...register("firstName")} />
                {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" {...register("lastName")} />
                {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...register("username")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone</Label>
              <Input id="phoneNumber" {...register("phoneNumber")} />
            </div>
            <Button type="submit" disabled={updateProfile.isPending || !isDirty}>
              {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </CardContent>
        </form>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible account actions</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">Deactivate Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Deactivate Account</DialogTitle>
                <DialogDescription>This action will disable your account. Enter your password to confirm.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleDeactivate((d) => deactivate.mutate(d))}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="deactivatePassword">Password</Label>
                    <Input id="deactivatePassword" type="password" {...regDeactivate("password")} />
                    {deactivateErrors.password && <p className="text-sm text-destructive">{deactivateErrors.password.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason (optional)</Label>
                    <Input id="reason" {...regDeactivate("reason")} placeholder="Why are you leaving?" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDeactivateOpen(false)}>Cancel</Button>
                  <Button type="submit" variant="destructive" disabled={deactivate.isPending}>
                    {deactivate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Deactivate
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
