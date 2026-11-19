"use client";

import { useState } from "react";
import { useCategoryAnalytics, useEventAnalytics, downloadPdf } from "@/hooks/use-dashboard";
import { useEvents } from "@/hooks/use-booking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Download, DollarSign, Ticket, Users,
  TrendingUp, PieChart as PieChartIcon, Calendar,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart,
} from "recharts";
import { toast } from "sonner";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function CategoryAnalytics() {
  const { data, isLoading } = useCategoryAnalytics();

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (!data) return <p className="text-muted-foreground">No data available</p>;

  const pieData = data.categoryStats?.map((c) => ({
    name: c.category,
    value: c.revenue,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Overall Revenue */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total Revenue (All Categories)</p>
          <p className="text-4xl font-extrabold tracking-tight text-primary">
            {formatCurrency(data.overallRevenue || 0)}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await downloadPdf("/admin/analytics/report/pdf", "revenue-analytics-report.pdf");
              toast.success("PDF downloaded!");
            } catch { toast.error("Failed to download PDF"); }
          }}
        >
          <Download className="h-4 w-4 mr-2" /> Export PDF
        </Button>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.categoryStats?.map((c, i) => (
          <Card key={c.category} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-sm font-semibold">{c.category}</span>
              </div>
              <p className="text-lg font-bold">{formatCurrency(c.revenue)}</p>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{c.eventCount} events</span>
                <span>{c.ticketsSold} tickets</span>
                <span>{c.averageOccupancy}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue by Category (Pie) */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4" /> Revenue by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={(props: any) => `${props.name || ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tickets Sold by Category (Bar) */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Tickets Sold by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.categoryStats || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="category" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="ticketsSold" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Trend */}
      {data.monthlyRevenue && data.monthlyRevenue.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Monthly Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EventAnalytics({ eventId }: { eventId: string }) {
  const { data, isLoading } = useEventAnalytics(eventId);

  if (isLoading) return <Skeleton className="h-[300px] w-full" />;
  if (!data) return <p className="text-muted-foreground">Select an event to view analytics</p>;

  const tierData = data.tierBreakdown?.map((t) => ({
    name: t.tierName,
    sold: t.soldQuantity,
    available: t.totalQuantity - t.soldQuantity,
    revenue: t.revenue,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">{data.eventName}</h3>
          <div className="flex gap-2 mt-1">
            <Badge variant="secondary">{data.category}</Badge>
            <Badge variant={data.status === "COMPLETED" ? "default" : "outline"}>{data.status}</Badge>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await downloadPdf(`/admin/analytics/event/${eventId}/pdf`, `event-report-${eventId}.pdf`);
              toast.success("PDF downloaded!");
            } catch { toast.error("Failed to download PDF"); }
          }}
        >
          <Download className="h-4 w-4 mr-2" /> Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Revenue", value: formatCurrency(data.totalRevenue || 0), icon: DollarSign, color: "text-emerald-600" },
          { label: "Tickets Sold", value: data.ticketsSold, icon: Ticket, color: "text-blue-600" },
          { label: "Total Tickets", value: data.totalTickets, icon: Calendar, color: "text-purple-600" },
          { label: "Check-ins", value: data.checkIns, icon: Users, color: "text-pink-600" },
          { label: "Occupancy", value: `${data.occupancyRate?.toFixed(1)}%`, icon: TrendingUp, color: "text-amber-600" },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="py-3 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tier breakdown chart */}
      {tierData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ticket Tier Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={tierData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="sold" stackId="a" fill="#3b82f6" name="Sold" radius={[0, 0, 0, 0]} />
                <Bar dataKey="available" stackId="a" fill="#e2e8f0" name="Available" radius={[4, 4, 0, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [tab, setTab] = useState<"overview" | "event">("overview");
  const { data: eventsPage } = useEvents(0, 200);

  const events = eventsPage?.content || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Revenue Analytics
        </h1>
        <div className="flex gap-2">
          <Button variant={tab === "overview" ? "default" : "outline"} size="sm" onClick={() => setTab("overview")}>
            Overview
          </Button>
          <Button variant={tab === "event" ? "default" : "outline"} size="sm" onClick={() => setTab("event")}>
            Per Event
          </Button>
        </div>
      </div>

      {tab === "overview" ? (
        <CategoryAnalytics />
      ) : (
        <div className="space-y-4">
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select an event..." />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} ({e.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEventId && <EventAnalytics eventId={selectedEventId} />}
        </div>
      )}
    </div>
  );
}
