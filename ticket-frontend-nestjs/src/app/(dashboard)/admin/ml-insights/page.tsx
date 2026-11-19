"use client";

import { useDashboardStats } from "@/hooks/use-dashboard";
import { useEvents } from "@/hooks/use-booking";
import {
  useFraudReport, useDemandForecast, usePricingSignals, useDemandHeatmap,
  useMlStatus, useTrainAllModels,
} from "@/hooks/use-ml";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, ShieldAlert, TrendingUp, Zap, Target,
  AlertTriangle, CheckCircle, Clock, BarChart3,
  ArrowLeft, Activity, Flame, Eye, Server, RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Cell, PieChart, Pie,
} from "recharts";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

const RISK_COLORS = {
  LOW: "bg-green-100 text-green-700 border-green-300",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-300",
  HIGH: "bg-orange-100 text-orange-700 border-orange-300",
  CRITICAL: "bg-red-100 text-red-700 border-red-300",
};

const TREND_ICONS = {
  ACCELERATING: { icon: TrendingUp, color: "text-green-600", label: "Accelerating" },
  STEADY: { icon: Activity, color: "text-blue-600", label: "Steady" },
  DECELERATING: { icon: TrendingUp, color: "text-orange-600", label: "Decelerating" },
  STALLED: { icon: Clock, color: "text-gray-500", label: "Stalled" },
};

export default function MlInsightsPage() {
  const { data: events } = useEvents(0, 10);
  const { data: fraudReport, isLoading: fraudLoading } = useFraudReport();
  const { data: mlStatus } = useMlStatus();
  const trainAll = useTrainAllModels();
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const firstEventId = selectedEventId || events?.content?.[0]?.id || "";
  const { data: forecast, isLoading: forecastLoading } = useDemandForecast(firstEventId);
  const { data: pricing } = usePricingSignals(firstEventId);
  const { data: heatmap } = useDemandHeatmap(firstEventId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-5 w-5 text-purple-600" />
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-purple-600">
              Machine Learning
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">ML Insights</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-powered analytics: fraud detection, demand forecasting & dynamic pricing
          </p>
        </div>
        <Link href="/admin/dashboard">
          <Badge variant="outline" className="gap-1 px-3 py-1.5 hover:bg-accent transition-colors cursor-pointer">
            <ArrowLeft className="h-3 w-3" />
            Back to Dashboard
          </Badge>
        </Link>
      </div>

      {/* FastAPI ML Service Status */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Server className="h-5 w-5 text-indigo-500" />
          <h2 className="text-xl font-bold">ML Service (FastAPI + scikit-learn)</h2>
          <Badge
            variant={mlStatus?.health?.status === "healthy" ? "default" : "secondary"}
            className={mlStatus?.health?.status === "healthy" ? "bg-green-600" : ""}
          >
            {mlStatus?.health?.status === "healthy" ? "Online" : mlStatus?.fallback ? "Fallback" : "Checking..."}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {mlStatus?.health?.models && Object.entries(mlStatus.health.models).map(([name, status]) => (
            <Card key={name} className="border-0 bg-white/90 shadow-sm">
              <CardContent className="py-3 text-center">
                <p className="text-sm font-mono font-bold capitalize">{name}</p>
                <Badge variant={status === "loaded" ? "default" : "outline"} className="mt-1">
                  {status === "loaded" ? "Trained" : "Not Trained"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => trainAll.mutate()}
            disabled={trainAll.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${trainAll.isPending ? "animate-spin" : ""}`} />
            {trainAll.isPending ? "Training Models..." : "Train All Models"}
          </button>
          {trainAll.isSuccess && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              Models trained successfully
            </Badge>
          )}
          {trainAll.isError && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
              Training failed — ML service may be offline
            </Badge>
          )}
        </div>
      </section>

      {/* Event Selector */}
      {events?.content && events.content.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">Select Event:</label>
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            <option value="">Auto (first event)</option>
            {events.content.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({ev.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ─── FRAUD DETECTION SECTION ─────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="h-5 w-5 text-red-500" />
          <h2 className="text-xl font-bold">Fraud Detection</h2>
          <Badge variant="secondary" className="text-xs">Real-time</Badge>
        </div>

        {fraudLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="py-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : fraudReport ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="border-0 bg-white/90 shadow-sm">
                <CardContent className="py-4 text-center">
                  <Eye className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                  <p className="text-2xl font-extrabold">{fraudReport.totalUsersAnalyzed}</p>
                  <p className="text-xs text-muted-foreground">Users Scanned</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-green-50 shadow-sm">
                <CardContent className="py-4 text-center">
                  <CheckCircle className="h-5 w-5 mx-auto text-green-500 mb-1" />
                  <p className="text-2xl font-extrabold text-green-700">{fraudReport.summary.low}</p>
                  <p className="text-xs text-muted-foreground">Low Risk</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-yellow-50 shadow-sm">
                <CardContent className="py-4 text-center">
                  <AlertTriangle className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
                  <p className="text-2xl font-extrabold text-yellow-700">{fraudReport.summary.medium}</p>
                  <p className="text-xs text-muted-foreground">Medium Risk</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-orange-50 shadow-sm">
                <CardContent className="py-4 text-center">
                  <Flame className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                  <p className="text-2xl font-extrabold text-orange-700">{fraudReport.summary.high}</p>
                  <p className="text-xs text-muted-foreground">High Risk</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-red-50 shadow-sm">
                <CardContent className="py-4 text-center">
                  <ShieldAlert className="h-5 w-5 mx-auto text-red-500 mb-1" />
                  <p className="text-2xl font-extrabold text-red-700">{fraudReport.summary.critical}</p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </CardContent>
              </Card>
            </div>

            {/* Flagged Users */}
            {fraudReport.flaggedUsers.length > 0 && (
              <Card className="border-0 bg-white/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Flagged Users</CardTitle>
                  <CardDescription>Users with risk score &ge; 50</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {fraudReport.flaggedUsers.slice(0, 10).map((user) => (
                      <div
                        key={user.userId}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge className={RISK_COLORS[user.riskLevel]} variant="outline">
                            {user.riskLevel}
                          </Badge>
                          <span className="text-sm font-mono">{user.userId.slice(0, 8)}...</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-lg font-bold">{user.riskScore}</span>
                            <span className="text-xs text-muted-foreground">/100</span>
                          </div>
                          <Badge
                            variant={user.recommendation === "BLOCK" ? "destructive" : "secondary"}
                          >
                            {user.recommendation}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="border-0 bg-green-50">
            <CardContent className="py-8 text-center">
              <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
              <p className="font-medium text-green-700">All Clear</p>
              <p className="text-sm text-muted-foreground">No suspicious activity detected</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ─── DEMAND FORECASTING SECTION ──────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          <h2 className="text-xl font-bold">Demand Forecast</h2>
          {forecast && (
            <Badge variant="secondary" className="text-xs">
              Confidence: {(forecast.confidence * 100).toFixed(0)}%
            </Badge>
          )}
        </div>

        {forecastLoading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="py-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : forecast ? (
          <div className="space-y-4">
            {/* Forecast Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-0 bg-white/90 shadow-sm">
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Fill Rate</p>
                  <p className="text-2xl font-extrabold">
                    {(forecast.fillRate * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {forecast.currentSold} / {forecast.totalCapacity}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white/90 shadow-sm">
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Sellout Probability</p>
                  <p className={`text-2xl font-extrabold ${
                    forecast.selloutProbability > 0.7 ? "text-green-600" :
                    forecast.selloutProbability > 0.4 ? "text-yellow-600" :
                    "text-gray-600"
                  }`}>
                    {(forecast.selloutProbability * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">ML prediction</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white/90 shadow-sm">
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">24h Forecast</p>
                  <p className="text-2xl font-extrabold">{forecast.predictedSoldIn24h}</p>
                  <p className="text-xs text-muted-foreground">tickets expected</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white/90 shadow-sm">
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">72h Forecast</p>
                  <p className="text-2xl font-extrabold">{forecast.predictedSoldIn72h}</p>
                  <p className="text-xs text-muted-foreground">tickets expected</p>
                </CardContent>
              </Card>
            </div>

            {/* Velocity & Recommendations */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Sales Velocity */}
              <Card className="border-0 bg-white/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" /> Sales Velocity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const trendInfo = TREND_ICONS[forecast.velocity.trend];
                    const TrendIcon = trendInfo.icon;
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <TrendIcon className={`h-5 w-5 ${trendInfo.color} ${
                            forecast.velocity.trend === 'DECELERATING' ? 'rotate-180' : ''
                          }`} />
                          <span className={`font-bold ${trendInfo.color}`}>
                            {trendInfo.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 rounded-lg bg-blue-50">
                            <p className="text-lg font-bold">{forecast.velocity.ticketsPerHour.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground">per hour</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-purple-50">
                            <p className="text-lg font-bold">{forecast.velocity.ticketsPerDay.toFixed(0)}</p>
                            <p className="text-xs text-muted-foreground">per day</p>
                          </div>
                        </div>
                        {forecast.predictedSelloutDate && (
                          <p className="text-sm text-muted-foreground">
                            Predicted sellout: {new Date(forecast.predictedSelloutDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* AI Recommendations */}
              <Card className="border-0 bg-white/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-500" /> AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {forecast.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-100 text-sm"
                      >
                        {rec}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Demand Heatmap */}
            {heatmap && heatmap.hourlyDemand && (
              <Card className="border-0 bg-white/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-orange-500" /> Booking Heatmap (Hourly)
                  </CardTitle>
                  <CardDescription>
                    Peak hours: {heatmap.peakHours.map(h => `${h}:00`).join(', ')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={heatmap.hourlyDemand}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="hour" fontSize={10} tickFormatter={(h) => `${h}h`} />
                      <YAxis fontSize={10} />
                      <Tooltip formatter={(v) => [v, 'Bookings']} />
                      <Bar dataKey="avgBookings" radius={[3, 3, 0, 0]}>
                        {heatmap.hourlyDemand.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={heatmap.peakHours.includes(entry.hour) ? "#f97316" : "#93c5fd"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="border-0 bg-blue-50">
            <CardContent className="py-8 text-center">
              <TrendingUp className="h-8 w-8 mx-auto text-blue-400 mb-2" />
              <p className="text-sm text-muted-foreground">Select an event to see forecasts</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ─── DYNAMIC PRICING SECTION ─────────────────────────────────── */}
      {pricing && pricing.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-emerald-500" />
            <h2 className="text-xl font-bold">ML Pricing Signals</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pricing.map((signal) => {
              const diff = signal.suggestedPrice - signal.currentPrice;
              const diffPercent = ((diff / signal.currentPrice) * 100).toFixed(1);
              const isIncrease = diff > 0;

              return (
                <Card key={signal.tierId} className="border-0 bg-white/90 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{signal.tierName}</CardTitle>
                    <CardDescription className="text-xs">{signal.reason}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-3 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Current</p>
                        <p className="text-lg font-bold">{formatCurrency(signal.currentPrice)}</p>
                      </div>
                      <span className="text-xl text-muted-foreground mb-1">&rarr;</span>
                      <div>
                        <p className="text-xs text-muted-foreground">Suggested</p>
                        <p className={`text-lg font-bold ${isIncrease ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(signal.suggestedPrice)}
                        </p>
                      </div>
                      <Badge
                        variant={isIncrease ? "default" : "secondary"}
                        className={`mb-1 ${isIncrease ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {isIncrease ? "+" : ""}{diffPercent}%
                      </Badge>
                    </div>

                    {/* Factor breakdown */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-blue-50 text-center">
                        <p className="font-bold">{signal.factors.velocityFactor.toFixed(2)}x</p>
                        <p className="text-muted-foreground">Velocity</p>
                      </div>
                      <div className="p-2 rounded bg-purple-50 text-center">
                        <p className="font-bold">{signal.factors.timeFactor.toFixed(2)}x</p>
                        <p className="text-muted-foreground">Time</p>
                      </div>
                      <div className="p-2 rounded bg-orange-50 text-center">
                        <p className="font-bold">{signal.factors.fillFactor.toFixed(2)}x</p>
                        <p className="text-muted-foreground">Fill Rate</p>
                      </div>
                      <div className="p-2 rounded bg-green-50 text-center">
                        <p className="font-bold">{(signal.confidence * 100).toFixed(0)}%</p>
                        <p className="text-muted-foreground">Confidence</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Model Version Footer */}
      {forecast && (
        <div className="text-center text-xs text-muted-foreground py-4 border-t">
          Model: {forecast.modelVersion} | Last updated: {new Date(forecast.forecastedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
