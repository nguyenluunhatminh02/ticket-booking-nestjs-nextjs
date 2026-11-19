"use client";

import { useEvents, useEventSearch } from "@/hooks/use-booking";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useState, useMemo, memo, useCallback } from "react";
import { Search, MapPin, Calendar, Ticket, ArrowRight, Map, Sparkles, Filter } from "lucide-react";
import type { EventResponse } from "@/types/booking";
import dynamic from "next/dynamic";
import { useTranslation } from "@/lib/i18n";

const EventsMap = dynamic(() => import("@/components/booking/events-map"), { ssr: false });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CATEGORY_STYLES: Record<string, { bg: string; gradient: string; gradientFull: string; icon: string }> = {
  CONCERT: { bg: "bg-purple-100 text-purple-800 border-purple-200", gradient: "from-purple-500/10 to-purple-600/5", gradientFull: "from-purple-500 to-violet-600", icon: "🎵" },
  SPORTS: { bg: "bg-green-100 text-green-800 border-green-200", gradient: "from-green-500/10 to-green-600/5", gradientFull: "from-emerald-500 to-green-600", icon: "⚽" },
  THEATER: { bg: "bg-amber-100 text-amber-800 border-amber-200", gradient: "from-amber-500/10 to-amber-600/5", gradientFull: "from-amber-500 to-orange-600", icon: "🎭" },
  COMEDY: { bg: "bg-pink-100 text-pink-800 border-pink-200", gradient: "from-pink-500/10 to-pink-600/5", gradientFull: "from-pink-500 to-rose-600", icon: "😂" },
  FESTIVAL: { bg: "bg-orange-100 text-orange-800 border-orange-200", gradient: "from-orange-500/10 to-orange-600/5", gradientFull: "from-orange-500 to-red-600", icon: "🎪" },
  CONFERENCE: { bg: "bg-blue-100 text-blue-800 border-blue-200", gradient: "from-blue-500/10 to-blue-600/5", gradientFull: "from-blue-500 to-indigo-600", icon: "💼" },
  OTHER: { bg: "bg-gray-100 text-gray-800 border-gray-200", gradient: "from-gray-500/10 to-gray-600/5", gradientFull: "from-gray-500 to-slate-600", icon: "🎟️" },
};

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "ON_SALE" || s === "PRESALE") return "default";
  if (s === "SOLD_OUT") return "destructive";
  return "secondary";
}

const EventCard = memo(function EventCard({ event, index }: { event: EventResponse; index: number }) {
  const cheapest = event.ticketTiers.length
    ? Math.min(...event.ticketTiers.map((t) => t.price))
    : null;
  const catStyle = CATEGORY_STYLES[event.category] || CATEGORY_STYLES.OTHER;
  const availPct = event.totalTickets > 0 ? (event.availableTickets / event.totalTickets) * 100 : 0;

  return (
    <Link href={`/events/${event.id}`} className="group">
      <Card
        className="overflow-hidden h-full flex flex-col border-0 bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 group-hover:-translate-y-1.5 card-shine stagger-in"
        style={{ animationDelay: `${index * 60}ms` }}
      >
        {/* Premium gradient header */}
        <div className={`h-1.5 bg-gradient-to-r ${catStyle.gradientFull} group-hover:h-2.5 transition-all duration-500`} />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${catStyle.bg}`}>
              {catStyle.icon} {event.category}
            </span>
            <Badge variant={statusVariant(event.status)} className="text-[10px] uppercase tracking-wider font-bold">
              {event.status.replace("_", " ")}
            </Badge>
          </div>
          <CardTitle className="text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-300">
            {event.name}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 space-y-2.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-red-50">
              <MapPin className="h-3.5 w-3.5 text-red-500" />
            </div>
            <span className="truncate">{event.venue.name}, {event.venue.city}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-blue-50">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <span>{formatDate(event.eventDate)}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-50">
              <Ticket className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <span>{event.availableTickets}/{event.totalTickets} available</span>
          </div>

          {/* Premium availability bar */}
          <div className="pt-1">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  availPct > 50 ? "bg-gradient-to-r from-green-400 to-emerald-500" : availPct > 20 ? "bg-gradient-to-r from-yellow-400 to-amber-500" : "bg-gradient-to-r from-red-400 to-rose-500"
                }`}
                style={{ width: `${availPct}%` }}
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-3 border-t border-border/50 flex items-center justify-between">
          {cheapest !== null ? (
            <div>
              <span className="text-xs text-muted-foreground">From</span>
              <span className="ml-1.5 font-extrabold text-lg bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">${cheapest.toFixed(2)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">Price TBA</span>
          )}
          <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary transition-all duration-300">
            <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">View</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
});

const CATEGORIES = ["All", "CONCERT", "SPORTS", "THEATER", "COMEDY", "FESTIVAL", "CONFERENCE"];

export default function EventsPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showMap, setShowMap] = useState(false);
  const eventsQuery = useEvents();
  const searchQuery = useEventSearch(search);
  const { t } = useTranslation();

  const rawEvents = search ? searchQuery.data?.content : eventsQuery.data?.content;
  const isLoading = search ? searchQuery.isLoading : eventsQuery.isLoading;

  const events = useMemo(() => {
    if (!rawEvents) return [];
    if (selectedCategory === "All") return rawEvents;
    return rawEvents.filter((e) => e.category === selectedCategory);
  }, [rawEvents, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Premium hero header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/8 via-blue-50/80 to-indigo-50/60 -mx-4 px-6 py-10 rounded-2xl">
        {/* Decorative blurred circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-blue-400/10 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-primary">{t("events.subtitle")}</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 via-gray-800 to-gray-600 bg-clip-text text-transparent">
            {t("events.title")}
          </h1>

          <div className="relative mt-6 max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("events.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-white/90 backdrop-blur-sm shadow-lg shadow-primary/5 border-0 ring-1 ring-white/80 focus-visible:ring-2 focus-visible:ring-primary rounded-xl text-base"
            />
          </div>
        </div>
      </div>

      {/* Category filters - premium pill design */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const style = CATEGORY_STYLES[cat];
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all duration-300
                ${isActive
                  ? "bg-gradient-to-r from-primary to-blue-600 text-white border-transparent shadow-lg shadow-primary/25 scale-105"
                  : "bg-white/80 backdrop-blur-sm text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground hover:shadow-md"
                }`}
            >
              {style?.icon && <span className="mr-1.5">{style.icon}</span>}
              {cat === "All" ? t("events.allEvents") : cat.charAt(0) + cat.slice(1).toLowerCase()}
            </button>
          );
        })}
      </div>

      {/* Map toggle & Event Map */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("events.eventsFound", { count: events.length })}
        </p>
        <button
          onClick={() => setShowMap((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:border-primary/40 hover:text-foreground bg-white text-muted-foreground border-border"
        >
          <Map className="h-3.5 w-3.5" />
          {showMap ? t("events.hideMap") : t("events.showMap")}
        </button>
      </div>

      {showMap && events.length > 0 && (
        <EventsMap events={events} className="h-[400px] w-full rounded-xl border shadow-sm" />
      )}

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-0 shadow-sm bg-white/90">
              <div className="h-1.5 bg-gray-100" />
              <CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </CardContent>
              <CardFooter><Skeleton className="h-6 w-24" /></CardFooter>
            </Card>
          ))}
        </div>
      ) : events.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {events.map((event, i) => (
            <EventCard key={event.id} event={event} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-blue-50 mb-6">
            <Search className="h-8 w-8 text-primary/60" />
          </div>
          <p className="text-xl font-bold text-foreground">{t("common.noResults")}</p>
          <p className="mt-2 text-muted-foreground max-w-sm mx-auto">
            {search ? "Try a different search term or adjust your filters" : "Check back later for upcoming events!"}
          </p>
          {selectedCategory !== "All" && (
            <button
              onClick={() => setSelectedCategory("All")}
              className="mt-4 text-sm text-primary hover:underline font-medium"
            >
              Show all categories
            </button>
          )}
        </div>
      )}
    </div>
  );
}
