"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useLogout } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  User, Shield, Smartphone, KeyRound, LogOut, CalendarDays,
  Ticket, Tag, BarChart3, ScanLine, Users, Film, Calendar,
  ArrowRightLeft, TrendingUp, Menu, X, ChevronRight, Brain,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "@/lib/i18n";

const accountNavItems = [
  { href: "/profile", labelKey: "nav.profile", icon: User },
  { href: "/security", labelKey: "nav.security", icon: Shield },
  { href: "/devices", labelKey: "nav.devices", icon: Smartphone },
  { href: "/mfa", labelKey: "nav.mfa", icon: KeyRound },
];

const bookingNavItems = [
  { href: "/events", labelKey: "nav.events", icon: CalendarDays },
  { href: "/reservations", labelKey: "nav.reservations", icon: Ticket },
  { href: "/tickets", labelKey: "nav.myTickets", icon: Ticket },
  { href: "/resale", labelKey: "nav.resale", icon: ArrowRightLeft },
  { href: "/organizers", labelKey: "nav.organizers", icon: Users },
  { href: "/coupons", labelKey: "nav.coupons", icon: Tag, adminOnly: true },
  { href: "/admin/dashboard", labelKey: "nav.dashboard", icon: BarChart3, adminOnly: true },
  { href: "/admin/analytics", labelKey: "nav.analytics", icon: TrendingUp, adminOnly: true },
  { href: "/admin/calendar", labelKey: "nav.calendar", icon: Calendar, adminOnly: true },
  { href: "/admin/check-in", labelKey: "nav.checkIn", icon: ScanLine, adminOnly: true },
  { href: "/admin/video", labelKey: "nav.videoMux", icon: Film, adminOnly: true },
  { href: "/admin/ml-insights", labelKey: "ML Insights", icon: Brain, adminOnly: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const logout = useLogout();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase() || "U";

  const NavContent = () => (
    <>
      <p className="px-3 mb-1.5 text-[10px] font-bold uppercase text-muted-foreground/60 tracking-[0.15em]">{t("nav.booking")}</p>
      <ul className="space-y-0.5 mb-5">
        {bookingNavItems
          .filter((item) => !item.adminOnly || user?.roles?.includes("ROLE_ADMIN"))
          .map(({ href, labelKey, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4 flex-shrink-0 transition-transform duration-200", !isActive && "group-hover:scale-110")} />
                  <span className="flex-1">{t(labelKey)}</span>
                  {isActive && <ChevronRight className="h-3 w-3 opacity-70" />}
                </Link>
              </li>
            );
          })}
      </ul>
      <Separator className="my-3 opacity-50" />
      <p className="px-3 mb-1.5 text-[10px] font-bold uppercase text-muted-foreground/60 tracking-[0.15em]">{t("nav.account")}</p>
      <ul className="space-y-0.5">
        {accountNavItems.map(({ href, labelKey, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0 transition-transform duration-200", !isActive && "group-hover:scale-110")} />
                <span className="flex-1">{t(labelKey)}</span>
                {isActive && <ChevronRight className="h-3 w-3 opacity-70" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30">
      {/* Top nav - glassmorphism */}
      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-accent transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/events" className="flex items-center gap-2.5 group">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 text-white shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow">
                <Ticket className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent hidden sm:inline">
                {t("common.appName")}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <div className="h-6 w-px bg-border/60 hidden sm:block" />
            <Link href="/profile" className="flex items-center gap-2.5 hover:bg-accent rounded-xl px-2.5 py-1.5 transition-colors">
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="" className="h-8 w-8 rounded-xl object-cover ring-2 ring-primary/20" />
              ) : (
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-blue-600/20 text-primary text-xs font-bold flex items-center justify-center ring-2 ring-primary/10">
                  {initials}
                </div>
              )}
              <div className="hidden sm:block">
                <p className="text-sm font-semibold leading-none">{user?.firstName} {user?.lastName}</p>
                <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
                  {user?.roles?.includes("ROLE_ADMIN") ? "Administrator" : "Member"}
                </p>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout.mutate()}
              className="text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl h-9 w-9"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <nav className="absolute left-0 top-16 bottom-0 w-72 bg-white/95 backdrop-blur-xl border-r shadow-2xl p-4 overflow-y-auto animate-in slide-in-from-left">
            <NavContent />
          </nav>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Side nav - hidden on mobile */}
          <nav className="hidden md:block w-60 flex-shrink-0">
            <div className="sticky top-24 space-y-1">
              <NavContent />
            </div>
          </nav>

          {/* Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/60 bg-white/50 backdrop-blur-sm mt-12">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-blue-600 text-white flex items-center justify-center">
                <Ticket className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">{t("common.appName")}</span>
            </div>
            <p className="text-xs text-muted-foreground/60">
              &copy; {new Date().getFullYear()} Ticket Booking. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
