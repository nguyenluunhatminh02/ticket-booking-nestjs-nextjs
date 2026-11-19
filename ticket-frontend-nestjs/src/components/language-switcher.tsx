"use client";

import { useTranslation, LOCALE_FLAGS, LOCALES, type Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const { t, locale, setLocale } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{LOCALE_FLAGS[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {LOCALES.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => setLocale(loc as Locale)}
            className={locale === loc ? "bg-primary/10 text-primary font-medium" : ""}
          >
            <span className="mr-2">{LOCALE_FLAGS[loc]}</span>
            {t(`languages.${loc}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
