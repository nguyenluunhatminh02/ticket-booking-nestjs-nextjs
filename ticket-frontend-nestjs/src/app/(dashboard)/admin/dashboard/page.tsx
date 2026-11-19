"use client";

import { useDashboardStats } from "@/hooks/use-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, CreditCard, Ticket, Users, TrendingUp,
  BarChart3, CheckCircle, DollarSign, ArrowUpRight, Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-sm bg-white/90">
              <CardContent className="py-5">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return <p>Failed to load dashboard</p>;

  const statCards = [
    { label: "Total Events", value: stats.totalEvents, icon: CalendarDays, color: "text-blue-600", bgColor: "from-blue-500/10 to-blue-600/5" },
    { label: "On Sale", value: stats.onSaleEvents, icon: TrendingUp, color: "text-green-600", bgColor: "from-green-500/10 to-green-600/5" },
    { label: "Sold Out", value: stats.soldOutEvents, icon: CheckCircle, color: "text-amber-600", bgColor: "from-amber-500/10 to-amber-600/5" },
    { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: "text-emerald-600", bgColor: "from-emerald-500/10 to-emerald-600/5" },
    { label: "Tickets Sold", value: stats.totalTicketsSold, icon: Ticket, color: "text-purple-600", bgColor: "from-purple-500/10 to-purple-600/5" },
    { label: "Check-ins", value: stats.totalCheckIns, icon: Users, color: "text-pink-600", bgColor: "from-pink-500/10 to-pink-600/5" },
    { label: "Occupancy Rate", value: `${stats.averageOccupancyRate}%`, icon: BarChart3, color: "text-indigo-600", bgColor: "from-indigo-500/10 to-indigo-600/5" },
    { label: "Payments", value: stats.totalPayments, icon: CreditCard, color: "text-orange-600", bgColor: "from-orange-500/10 to-orange-600/5" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Overview</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time platform analytics</p>
        </div>
        <Link href="/admin/analytics">
          <Badge variant="outline" className="gap-1 px-3 py-1.5 hover:bg-accent transition-colors cursor-pointer">
            <BarChart3 className="h-3 w-3" />
            Detailed Analytics
            <ArrowUpRight className="h-3 w-3" />
          </Badge>
        </Link>
      </div>

      {/* Stat cards - premium glassmorphism */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bgColor }, i) => (
          <Card key={label} className="border-0 bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-lg transition-all duration-300 stagger-in overflow-hidden" style={{ animationDelay: `${i * 50}ms` }}>
            <CardContent className="py-4 relative">
              <div className={`absolute inset-0 bg-gradient-to-br ${bgColor} opacity-50`} />
              <div className="relative flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-white/80 shadow-sm ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className="text-xl font-extrabold">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      {stats.revenueByDay.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Revenue Trend Chart */}
          <Card className="border-0 bg-white/90 backdrop-blur-sm shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Revenue Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={stats.revenueByDay.slice(0, 14).reverse()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" fontSize={10} tickFormatter={(d) => d.slice(5)} />
                  <YAxis fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tickets Sold Chart */}
          <Card className="border-0 bg-white/90 backdrop-blur-sm shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="h-4 w-4 text-purple-600" /> Daily Ticket Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.revenueByDay.slice(0, 14).reverse()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" fontSize={10} tickFormatter={(d) => d.slice(5)} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="ticketsSold" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top selling events */}
      <Card className="border-0 bg-white/90 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" /> Top Selling Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topSellingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet</p>
          ) : (
            <div className="space-y-2">
              {stats.topSellingEvents.map((event, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-accent/50 transition-colors border-b last:border-0 border-border/30">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${
                      i === 0 ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm" :
                      i === 1 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white" :
                      i === 2 ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white" :
                      "bg-primary/10 text-primary"
                    }`}>
                      {i + 1}
                    </span>
                    <span className="font-medium text-sm">{event.eventName}</span>
                  </div>
                  <Badge variant="secondary" className="font-bold">{event.ticketsSold} sold</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
