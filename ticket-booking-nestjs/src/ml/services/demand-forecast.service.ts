import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationStatus, EventStatus } from '../../booking/entities/enums';

/**
 * ML-based Demand Forecasting Service
 *
 * Predicts future ticket demand using time-series analysis:
 * - Sales velocity (tickets per hour/day)
 * - Exponential smoothing on historical patterns
 * - Days-to-event decay factor
 * - Category-based seasonality adjustments
 * - Sellout probability estimation
 * 
 * Used for:
 * - Admin dashboard predictions
 * - Auto-scaling queue capacity
 * - Dynamic pricing input signals
 * - Marketing timing optimization
 */

export interface SalesVelocity {
  ticketsPerHour: number;
  ticketsPerDay: number;
  trend: 'ACCELERATING' | 'STEADY' | 'DECELERATING' | 'STALLED';
  trendScore: number; // -1 to 1 (negative = slowing, positive = accelerating)
}

export interface DemandForecast {
  eventId: string;
  eventName: string;
  currentSold: number;
  totalCapacity: number;
  fillRate: number;

  // Predictions
  predictedSoldIn24h: number;
  predictedSoldIn72h: number;
  predictedSelloutDate: Date | null;
  selloutProbability: number; // 0-1

  // Velocity
  velocity: SalesVelocity;

  // Recommendations
  recommendations: string[];

  // Confidence
  confidence: number; // 0-1
  modelVersion: string;
  forecastedAt: Date;
}

export interface DemandHeatmap {
  eventId: string;
  hourlyDemand: { hour: number; avgBookings: number }[];
  dailyDemand: { day: string; avgBookings: number }[];
  peakHours: number[];
  peakDays: string[];
}

export interface PricingSignal {
  tierId: string;
  tierName: string;
  currentPrice: number;
  suggestedPrice: number;
  suggestedMultiplier: number;
  reason: string;
  confidence: number;
  factors: {
    velocityFactor: number;
    timeFactor: number;
    fillFactor: number;
    categoryFactor: number;
  };
}

@Injectable()
export class DemandForecastService {
  private readonly logger = new Logger(DemandForecastService.name);

  // Exponential smoothing alpha (0-1, higher = more weight on recent data)
  private readonly SMOOTHING_ALPHA = 0.3;

  constructor(private prisma: PrismaService) {}

  /**
   * Generate demand forecast for a specific event.
   */
  async forecastEvent(eventId: string): Promise<DemandForecast> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { ticketTiers: true },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    const totalCapacity = event.totalTickets || 0;
    const currentSold = totalCapacity - (event.availableTickets || 0);
    const fillRate = totalCapacity > 0 ? currentSold / totalCapacity : 0;

    // Calculate sales velocity
    const velocity = await this.calculateVelocity(eventId);

    // Predict future sales
    const daysToEvent = Math.max(0, 
      (new Date(event.eventDate!).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );

    const predicted24h = this.predictSales(velocity, 24, fillRate, daysToEvent, totalCapacity - currentSold);
    const predicted72h = this.predictSales(velocity, 72, fillRate, daysToEvent, totalCapacity - currentSold);

    // Sellout probability estimation
    const selloutProbability = this.estimateSelloutProbability(fillRate, velocity, daysToEvent);

    // Predicted sellout date
    let predictedSelloutDate: Date | null = null;
    if (velocity.ticketsPerHour > 0 && currentSold < totalCapacity) {
      const hoursToSellout = (totalCapacity - currentSold) / velocity.ticketsPerHour;
      predictedSelloutDate = new Date(Date.now() + hoursToSellout * 60 * 60 * 1000);
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      fillRate, velocity, daysToEvent, selloutProbability,
    );

    // Confidence based on data amount
    const reservationCount = await this.prisma.reservation.count({ where: { eventId } });
    const confidence = Math.min(1, reservationCount / 50); // Full confidence at 50+ bookings

    return {
      eventId,
      eventName: event.name,
      currentSold,
      totalCapacity,
      fillRate,
      predictedSoldIn24h: Math.min(totalCapacity, currentSold + predicted24h),
      predictedSoldIn72h: Math.min(totalCapacity, currentSold + predicted72h),
      predictedSelloutDate,
      selloutProbability,
      velocity,
      recommendations,
      confidence,
      modelVersion: '1.0.0-exponential-smoothing',
      forecastedAt: new Date(),
    };
  }

  /**
   * Get demand heatmap for an event (which hours/days are busiest).
   */
  async getDemandHeatmap(eventId: string): Promise<DemandHeatmap> {
    // Hourly distribution
    const hourlyData = await this.prisma.$queryRaw<any[]>`
      SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::int as count
      FROM reservations WHERE event_id = ${eventId}::uuid
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour ASC
    `;

    // Daily distribution
    const dailyData = await this.prisma.$queryRaw<any[]>`
      SELECT TO_CHAR(created_at, 'Day') as day, COUNT(*)::int as count
      FROM reservations WHERE event_id = ${eventId}::uuid
      GROUP BY TO_CHAR(created_at, 'Day')
    `;

    const hourlyDemand = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      avgBookings: parseInt(hourlyData.find(d => d.hour === h)?.count || '0'),
    }));

    const dailyDemand = dailyData.map(d => ({
      day: (d.day || '').trim(),
      avgBookings: parseInt(d.count || '0'),
    }));

    // Find peak hours (top 3)
    const sortedHours = [...hourlyDemand].sort((a, b) => b.avgBookings - a.avgBookings);
    const peakHours = sortedHours.slice(0, 3).map(h => h.hour);

    // Find peak days (top 2)
    const sortedDays = [...dailyDemand].sort((a, b) => b.avgBookings - a.avgBookings);
    const peakDays = sortedDays.slice(0, 2).map(d => d.day);

    return {
      eventId,
      hourlyDemand,
      dailyDemand,
      peakHours,
      peakDays,
    };
  }

  /**
   * Generate ML-enhanced pricing signals for each tier.
   */
  async getPricingSignals(eventId: string): Promise<PricingSignal[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { ticketTiers: true },
    });
    if (!event || !event.ticketTiers) return [];

    const velocity = await this.calculateVelocity(eventId);
    const daysToEvent = Math.max(0,
      (new Date(event.eventDate!).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );

    const signals: PricingSignal[] = [];

    for (const tier of event.ticketTiers) {
      const fillRate = (tier.totalQuantity ?? 0) > 0
        ? ((tier.totalQuantity ?? 0) - (tier.availableQuantity ?? 0)) / (tier.totalQuantity ?? 0)
        : 0;

      const factors = this.calculatePricingFactors(fillRate, velocity, daysToEvent);
      const combinedMultiplier =
        factors.velocityFactor * 0.3 +
        factors.timeFactor * 0.25 +
        factors.fillFactor * 0.35 +
        factors.categoryFactor * 0.1;

      const basePrice = Number(tier.price);
      const suggestedMultiplier = Math.max(0.7, Math.min(2.0, combinedMultiplier));
      const suggestedPrice = Math.round(basePrice * suggestedMultiplier * 100) / 100;

      let reason: string;
      if (suggestedMultiplier > 1.3) reason = 'High demand - surge pricing recommended';
      else if (suggestedMultiplier > 1.1) reason = 'Above average demand';
      else if (suggestedMultiplier < 0.85) reason = 'Low demand - discount recommended';
      else reason = 'Normal demand - standard pricing';

      signals.push({
        tierId: tier.id,
        tierName: tier.name,
        currentPrice: basePrice,
        suggestedPrice,
        suggestedMultiplier,
        reason,
        confidence: Math.min(1, fillRate * 2 + 0.3), // Higher fill = higher confidence
        factors,
      });
    }

    return signals;
  }

  // ─── CORE ML ALGORITHMS ───────────────────────────────────────────────────

  /**
   * Calculate sales velocity using exponential smoothing.
   */
  private async calculateVelocity(eventId: string): Promise<SalesVelocity> {
    // Get bookings per hour for the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const hourlyBookings = await this.prisma.$queryRaw<any[]>`
      SELECT DATE_TRUNC('hour', created_at) as "hourBucket", COUNT(*)::int as count
      FROM reservations
      WHERE event_id = ${eventId}::uuid
        AND created_at > ${sevenDaysAgo}
        AND status IN ('PENDING', 'CONFIRMED')
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY DATE_TRUNC('hour', created_at) ASC
    `;

    if (hourlyBookings.length === 0) {
      return {
        ticketsPerHour: 0,
        ticketsPerDay: 0,
        trend: 'STALLED',
        trendScore: 0,
      };
    }

    // Apply exponential smoothing
    let smoothedRate = parseInt(hourlyBookings[0].count);
    const rates: number[] = [];
    for (const bucket of hourlyBookings) {
      const rate = parseInt(bucket.count);
      smoothedRate = this.SMOOTHING_ALPHA * rate + (1 - this.SMOOTHING_ALPHA) * smoothedRate;
      rates.push(smoothedRate);
    }

    const ticketsPerHour = smoothedRate;
    const ticketsPerDay = ticketsPerHour * 24;

    // Calculate trend using linear regression on last N data points
    const recentRates = rates.slice(-Math.min(24, rates.length));
    const trendScore = this.calculateTrendSlope(recentRates);

    let trend: SalesVelocity['trend'];
    if (trendScore > 0.1) trend = 'ACCELERATING';
    else if (trendScore < -0.1) trend = 'DECELERATING';
    else if (ticketsPerHour > 0.1) trend = 'STEADY';
    else trend = 'STALLED';

    return { ticketsPerHour, ticketsPerDay, trend, trendScore };
  }

  /**
   * Simple linear regression to determine trend direction.
   */
  private calculateTrendSlope(data: number[]): number {
    if (data.length < 2) return 0;

    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i];
      sumXY += i * data[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;

    // Normalize slope relative to average
    return avgY > 0 ? slope / avgY : 0;
  }

  /**
   * Predict future sales using smoothed velocity + decay factor.
   */
  private predictSales(
    velocity: SalesVelocity,
    hours: number,
    currentFillRate: number,
    daysToEvent: number,
    remainingTickets: number,
  ): number {
    if (velocity.ticketsPerHour <= 0) return 0;

    // Base prediction from current velocity
    let predicted = velocity.ticketsPerHour * hours;

    // Apply trend adjustment
    if (velocity.trend === 'ACCELERATING') {
      predicted *= 1 + (velocity.trendScore * 0.5);
    } else if (velocity.trend === 'DECELERATING') {
      predicted *= 1 + (velocity.trendScore * 0.3); // trendScore is negative
    }

    // Approaching-event urgency boost
    if (daysToEvent < 7) {
      predicted *= 1 + (7 - daysToEvent) * 0.05; // Up to 35% boost in last week
    }

    // Scarcity effect: as fill rate increases, demand may spike
    if (currentFillRate > 0.8) {
      predicted *= 1.2; // 20% boost from scarcity marketing
    }

    // Cap at remaining tickets
    return Math.min(Math.round(predicted), remainingTickets);
  }

  /**
   * Estimate probability of sellout using logistic regression-style model.
   */
  private estimateSelloutProbability(
    fillRate: number,
    velocity: SalesVelocity,
    daysToEvent: number,
  ): number {
    // Logistic model: P(sellout) = sigmoid(w1*fill + w2*velocity_norm + w3*time_factor)
    const velocityNorm = Math.min(1, velocity.ticketsPerDay / 100); // Normalize
    const timeFactor = daysToEvent > 0 ? 1 / (1 + daysToEvent / 30) : 1;

    const z = 3.0 * fillRate + 2.0 * velocityNorm + 1.5 * timeFactor - 2.5;
    const probability = 1 / (1 + Math.exp(-z)); // Sigmoid

    return Math.round(probability * 100) / 100;
  }

  private calculatePricingFactors(
    fillRate: number,
    velocity: SalesVelocity,
    daysToEvent: number,
  ) {
    // Velocity factor: higher velocity → higher price
    let velocityFactor = 1.0;
    if (velocity.ticketsPerDay > 50) velocityFactor = 1.5;
    else if (velocity.ticketsPerDay > 20) velocityFactor = 1.3;
    else if (velocity.ticketsPerDay > 10) velocityFactor = 1.1;
    else if (velocity.ticketsPerDay < 2) velocityFactor = 0.8;

    // Time factor: closer to event → higher price
    let timeFactor = 1.0;
    if (daysToEvent < 1) timeFactor = 1.5;
    else if (daysToEvent < 3) timeFactor = 1.3;
    else if (daysToEvent < 7) timeFactor = 1.1;
    else if (daysToEvent > 30) timeFactor = 0.85;

    // Fill factor: higher fill → higher price
    let fillFactor = 1.0;
    if (fillRate > 0.95) fillFactor = 1.8;
    else if (fillRate > 0.9) fillFactor = 1.5;
    else if (fillRate > 0.8) fillFactor = 1.3;
    else if (fillRate > 0.6) fillFactor = 1.1;
    else if (fillRate < 0.2) fillFactor = 0.8;

    // Category factor (placeholder - in production, use historical data)
    const categoryFactor = 1.0;

    return { velocityFactor, timeFactor, fillFactor, categoryFactor };
  }

  private generateRecommendations(
    fillRate: number,
    velocity: SalesVelocity,
    daysToEvent: number,
    selloutProbability: number,
  ): string[] {
    const recs: string[] = [];

    if (selloutProbability > 0.8) {
      recs.push('🔥 High sellout probability — consider raising prices or adding more seats');
    }
    if (velocity.trend === 'ACCELERATING') {
      recs.push('📈 Sales accelerating — enable queue system for demand management');
    }
    if (velocity.trend === 'STALLED' && fillRate < 0.3) {
      recs.push('⚠️ Low demand — consider promotional pricing or marketing push');
    }
    if (daysToEvent < 3 && fillRate < 0.5) {
      recs.push('🕐 Event approaching with low fill — activate flash sale or discount codes');
    }
    if (fillRate > 0.9) {
      recs.push('🎯 Near capacity — prepare for SOLD_OUT status and waitlist');
    }
    if (velocity.ticketsPerDay > 50) {
      recs.push('⚡ High velocity — ensure infrastructure can handle peak load');
    }
    if (daysToEvent > 14 && fillRate > 0.6 && velocity.trend !== 'DECELERATING') {
      recs.push('💰 Strong early demand — optimal time for dynamic pricing increase');
    }

    if (recs.length === 0) {
      recs.push('✅ Normal demand pattern — no action needed');
    }

    return recs;
  }
}
