"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { loginSchema, type LoginFormValues } from "@/schemas/auth";
import { useLogin } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { useTranslation } from "@/lib/i18n";
import { useAuthModalStore } from "@/stores/auth-modal-store";

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const { mfaRequired } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useTranslation();
  const { isOpen: isModal, close: closeModal, switchView, redirectTo } = useAuthModalStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = async (data: LoginFormValues) => {
    await login.mutateAsync(data);
    // Read latest store state after mutation (closure value is stale)
    const { mfaRequired: mfaNow } = useAuthStore.getState();
    if (!mfaNow) {
      if (isModal) {
        closeModal();
        if (redirectTo) router.push(redirectTo);
      } else {
        router.push("/events");
      }
    } else {
      if (isModal) closeModal();
      router.push("/verify-mfa");
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">{t("auth.signIn")}</CardTitle>
        <CardDescription>{t("auth.enterCredentials")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" placeholder="name@example.com" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("auth.password")}</Label>
              {isModal ? (
                <button type="button" onClick={() => switchView("forgot-password")} className="text-sm text-primary hover:underline">
                  {t("auth.forgotPassword")}
                </button>
              ) : (
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  {t("auth.forgotPassword")}
                </Link>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="flex items-center space-x-2">
            <input type="checkbox" id="rememberMe" {...register("rememberMe")} className="rounded border-gray-300" />
            <Label htmlFor="rememberMe" className="text-sm font-normal">
              {t("auth.rememberMe")}
            </Label>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("auth.signIn")}
          </Button>

          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t("auth.continueWith")}</span>
            </div>
          </div>

          <SocialLoginButtons />

          <p className="text-sm text-muted-foreground text-center">
            {t("auth.noAccount")}{" "}
            {isModal ? (
              <button type="button" onClick={() => switchView("register")} className="text-primary hover:underline">
                {t("auth.signUp")}
              </button>
            ) : (
              <Link href="/register" className="text-primary hover:underline">
                {t("auth.signUp")}
              </Link>
            )}
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
