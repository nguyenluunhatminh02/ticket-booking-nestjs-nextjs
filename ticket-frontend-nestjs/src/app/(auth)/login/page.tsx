"use client";

import { LoginForm } from "@/components/auth/login-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Language Switcher */}
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      {/* Branding */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
          <span className="text-3xl">🎫</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">{t("common.appName")}</h1>
        <p className="text-sm text-slate-500">{t("auth.enterCredentials")}</p>
      </div>
      <LoginForm />
    </div>
  );
}
