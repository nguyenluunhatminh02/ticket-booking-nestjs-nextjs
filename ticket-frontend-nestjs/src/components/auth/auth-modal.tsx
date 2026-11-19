"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuthModalStore } from "@/stores/auth-modal-store";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export function AuthModal() {
  const { isOpen, view, close } = useAuthModalStore();

  if (!view) return null;

  const titles: Record<string, string> = {
    login: "Welcome Back",
    register: "Create Account",
    "forgot-password": "Reset Password",
  };

  const descriptions: Record<string, string> = {
    login: "Sign in to access your tickets and events",
    register: "Join us to discover and book amazing events",
    "forgot-password": "Enter your email to receive a reset link",
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden border-0 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{titles[view] || ""}</DialogTitle>
          <DialogDescription>{descriptions[view] || ""}</DialogDescription>
        </DialogHeader>
        <div className="p-6">
          {view === "login" && <LoginForm />}
          {view === "register" && <RegisterForm />}
          {view === "forgot-password" && <ForgotPasswordForm />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
