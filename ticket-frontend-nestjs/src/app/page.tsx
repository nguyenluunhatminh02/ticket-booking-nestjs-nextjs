"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { useAuthModalStore } from "@/stores/auth-modal-store";
import { AuthModal } from "@/components/auth/auth-modal";
import { useTranslation } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Ticket,
  CalendarDays,
  MapPin,
  Shield,
  Zap,
  Star,
  ArrowRight,
  Play,
  Sparkles,
  Globe,
  CreditCard,
  QrCode,
  Armchair,
} from "lucide-react";

const HERO_EVENTS = [
  { name: "Taylor Swift - Eras Tour", venue: "National Stadium, HCM", date: "Jun 15, 2026", price: "$149.99", category: "CONCERT", emoji: "🎵" },
  { name: "Ed Sheeran - Mathematics", venue: "Madison Square Garden", date: "Jul 21, 2026", price: "$79.99", category: "CONCERT", emoji: "🎸" },
  { name: "Hamilton - Musical", venue: "Sydney Opera House", date: "Sep 1, 2026", price: "$120.00", category: "THEATER", emoji: "🎭" },
];

const FEATURES = [
  { icon: Zap, title: "Lightning Fast", desc: "Book tickets in seconds with our optimized booking engine", color: "text-yellow-500", bg: "bg-yellow-50" },
  { icon: Shield, title: "Secure Payments", desc: "Multiple payment options: Stripe, PayPal, PayOS", color: "text-green-500", bg: "bg-green-50" },
  { icon: QrCode, title: "Dynamic QR Codes", desc: "TOTP-secured QR codes that refresh every 30 seconds", color: "text-blue-500", bg: "bg-blue-50" },
  { icon: Armchair, title: "Smart Seat Finder", desc: "AI-powered seat recommendations for the best experience", color: "text-purple-500", bg: "bg-purple-50" },
  { icon: Globe, title: "Multi-language", desc: "Available in English, Vietnamese, Chinese, Japanese, Korean", color: "text-red-500", bg: "bg-red-50" },
  { icon: CreditCard, title: "Resale Marketplace", desc: "Buy and sell tickets safely with built-in fraud protection", color: "text-indigo-500", bg: "bg-indigo-50" },
];

const STATS = [
  { value: "10K+", label: "Events" },
  { value: "500K+", label: "Tickets Sold" },
  { value: "99.9%", label: "Uptime" },
  { value: "4.9★", label: "Rating" },
];

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { open: openAuth } = useAuthModalStore();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If already authenticated, redirect to events (guard prevents double-fire in React Strict Mode)
  useEffect(() => {
    if (!isLoading && isAuthenticated && !redirected.current) {
      redirected.current = true;
      router.replace("/events");
    }
  }, [isAuthenticated, isLoading, router]);

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🎫</span>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
              {t("common.appName")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={() => openAuth("login")}>
              {t("auth.signIn")}
            </Button>
            <Button size="sm" onClick={() => openAuth("register")} className="shadow-md shadow-primary/25">
              {t("auth.signUp")}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-white to-indigo-50" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-primary/10 to-violet-200/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-cyan-100/40 to-blue-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text */}
            <div className="space-y-8">
              <div className="inline-flex">
                <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm font-medium bg-primary/10 text-primary border-0">
                  <Sparkles className="h-3.5 w-3.5" /> New: AI Smart Seat Finder
                </Badge>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                Book Your Next
                <br />
                <span className="bg-gradient-to-r from-primary via-indigo-500 to-violet-500 bg-clip-text text-transparent">
                  Unforgettable
                </span>
                <br />
                Experience
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Discover concerts, sports, theater and more. Secure your tickets instantly with smart seat selection, dynamic pricing, and multi-provider payments.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" onClick={() => openAuth("register")} className="h-12 px-8 text-base font-bold shadow-lg shadow-primary/25 gap-2">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => openAuth("login")} className="h-12 px-8 text-base font-bold gap-2">
                  <Play className="h-4 w-4" /> Browse Events
                </Button>
              </div>

              {/* Stats */}
              <div className="flex gap-8 pt-4">
                {STATS.map((stat) => (
                  <div key={stat.label}>
                    <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Event Cards Preview */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
              <div className="space-y-4 rotate-[-2deg]">
                {HERO_EVENTS.map((event, i) => (
                  <Card
                    key={i}
                    className={`border shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                      i === 0 ? "translate-x-4" : i === 2 ? "translate-x-8" : "translate-x-0"
                    }`}
                  >
                    <CardContent className="py-4 px-5 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-indigo-50 flex items-center justify-center text-2xl shrink-0">
                        {event.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{event.category}</Badge>
                        </div>
                        <p className="font-bold text-sm truncate">{event.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.venue}</span>
                          <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{event.date}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">From</p>
                        <p className="text-lg font-extrabold text-primary">{event.price}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <Star className="h-3.5 w-3.5" /> Why Choose Us
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Everything You Need for
              <br />
              <span className="text-primary">Event Ticketing</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From discovery to check-in, we provide a seamless experience with cutting-edge technology.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="border-0 shadow-sm hover:shadow-md transition-shadow group">
                <CardContent className="pt-6 pb-6">
                  <div className={`h-12 w-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              How It <span className="text-primary">Works</span>
            </h2>
            <p className="text-muted-foreground">Three simple steps to your next event</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Discover Events", desc: "Browse concerts, sports, theater and more. Filter by category, location, and date.", icon: CalendarDays, color: "from-blue-500 to-indigo-500" },
              { step: "02", title: "Choose Your Seats", desc: "Use our AI-powered seat finder or pick from the interactive 2D/3D seat map.", icon: Armchair, color: "from-violet-500 to-purple-500" },
              { step: "03", title: "Secure & Enjoy", desc: "Pay securely, get your dynamic QR code, and enjoy the event!", icon: Ticket, color: "from-emerald-500 to-teal-500" },
            ].map((item) => (
              <div key={item.step} className="text-center group">
                <div className={`h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                  <item.icon className="h-8 w-8 text-white" />
                </div>
                <span className="text-xs font-bold text-muted-foreground tracking-widest uppercase">Step {item.step}</span>
                <h3 className="text-xl font-bold mt-2 mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary via-indigo-600 to-violet-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Ready to Book Your Next Event?
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
            Join thousands of event-goers who trust us for their ticketing needs. Sign up free and start exploring.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              onClick={() => openAuth("register")}
              className="h-13 px-10 text-base font-bold bg-white text-primary hover:bg-white/90 shadow-xl gap-2"
            >
              Create Free Account <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => openAuth("login")}
              className="h-13 px-10 text-base font-bold text-white border-white/30 bg-white/10 hover:bg-white/20 gap-2"
            >
              {t("auth.signIn")}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900 text-slate-400">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎫</span>
              <span className="text-white font-bold">{t("common.appName")}</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <button onClick={() => openAuth("login")} className="hover:text-white transition-colors">
                {t("auth.signIn")}
              </button>
              <button onClick={() => openAuth("register")} className="hover:text-white transition-colors">
                {t("auth.signUp")}
              </button>
              <span>© 2026 {t("common.appName")}. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal />
    </div>
  );
}
