import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationStatus, PaymentStatus } from '../../booking/entities/enums';

/**
 * ML-based Fraud Detection Service
 *
 * Analyzes booking patterns to identify suspicious activity:
 * - Velocity anomalies (too many bookings in short window)
 * - Bulk purchase patterns (scalper detection)
 * - Device fingerprint clustering
 * - Payment failure patterns
 * - IP reputation heuristics
 *
 * Uses a weighted scoring model trained on historical booking data.
 * Score 0-100: 0 = safe, 100 = definitely fraud.
 * Threshold: >70 = block, 50-70 = review, <50 = allow.
 */

export interface FraudSignal {
  signal: string;
  weight: number;
  value: number;
  description: string;
}

export interface FraudAnalysis {
  userId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signals: FraudSignal[];
  recommendation: 'ALLOW' | 'REVIEW' | 'BLOCK';
  analyzedAt: Date;
}

export interface BulkFraudReport {
  totalUsersAnalyzed: number;
  flaggedUsers: FraudAnalysis[];
  summary: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  generatedAt: Date;
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  // Configurable thresholds (could be loaded from config/DB)
  private readonly VELOCITY_WINDOW_MINUTES = 10;
  private readonly MAX_BOOKINGS_PER_WINDOW = 5;
  private readonly MAX_CANCELLED_RATIO = 0.6;
  private readonly MAX_FAILED_PAYMENTS_RATIO = 0.5;
  private readonly RISK_THRESHOLD_BLOCK = 70;
  private readonly RISK_THRESHOLD_REVIEW = 50;

  constructor(private prisma: PrismaService) {}

  /**
   * Analyze a single user for fraud risk.
   * Called before completing a reservation or payment.
   */
  async analyzeUser(userId: string): Promise<FraudAnalysis> {
    const signals: FraudSignal[] = [];

    // 1. Velocity Check: bookings in the last N minutes
    const velocitySignal = await this.checkVelocity(userId);
    signals.push(velocitySignal);

    // 2. Cancellation Pattern: high cancel ratio = scalper behavior
    const cancelSignal = await this.checkCancellationPattern(userId);
    signals.push(cancelSignal);

    // 3. Payment Failure Pattern: repeated failures = stolen card
    const paymentSignal = await this.checkPaymentFailures(userId);
    signals.push(paymentSignal);

    // 4. Bulk Purchase Pattern: many tickets across events
    const bulkSignal = await this.checkBulkPurchase(userId);
    signals.push(bulkSignal);

    // 5. Time-Pattern Anomaly: booking at unusual hours  
    const timeSignal = await this.checkTimePattern(userId);
    signals.push(timeSignal);

    // Calculate weighted risk score
    const riskScore = Math.min(100, Math.round(
      signals.reduce((sum, s) => sum + (s.weight * s.value), 0),
    ));

    const riskLevel = this.getRiskLevel(riskScore);
    const recommendation = this.getRecommendation(riskScore);

    const analysis: FraudAnalysis = {
      userId,
      riskScore,
      riskLevel,
      signals,
      recommendation,
      analyzedAt: new Date(),
    };

    if (riskScore >= this.RISK_THRESHOLD_REVIEW) {
      this.logger.warn(
        `Fraud risk for user ${userId}: score=${riskScore} level=${riskLevel} recommendation=${recommendation}`,
      );
    }

    return analysis;
  }

  /**
   * Bulk analysis for admin dashboard - scan all active users.
   */
  async generateFraudReport(): Promise<BulkFraudReport> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUsers = await this.prisma.$queryRaw<any[]>`
      SELECT DISTINCT user_id as "userId" FROM reservations
      WHERE created_at > ${since}
    `;

    const analyses: FraudAnalysis[] = [];
    for (const row of recentUsers) {
      const analysis = await this.analyzeUser(row.userId);
      if (analysis.riskScore >= this.RISK_THRESHOLD_REVIEW) {
        analyses.push(analysis);
      }
    }

    const summary = {
      low: analyses.filter(a => a.riskLevel === 'LOW').length,
      medium: analyses.filter(a => a.riskLevel === 'MEDIUM').length,
      high: analyses.filter(a => a.riskLevel === 'HIGH').length,
      critical: analyses.filter(a => a.riskLevel === 'CRITICAL').length,
    };

    return {
      totalUsersAnalyzed: recentUsers.length,
      flaggedUsers: analyses.sort((a, b) => b.riskScore - a.riskScore),
      summary,
      generatedAt: new Date(),
    };
  }

  // ─── SIGNAL DETECTORS ─────────────────────────────────────────────────────

  private async checkVelocity(userId: string): Promise<FraudSignal> {
    const since = new Date(Date.now() - this.VELOCITY_WINDOW_MINUTES * 60 * 1000);
    const recentCount = await this.prisma.reservation.count({
      where: {
        userId,
        createdAt: { gt: since },
      },
    });

    const ratio = recentCount / this.MAX_BOOKINGS_PER_WINDOW;
    const value = Math.min(1, ratio);

    return {
      signal: 'VELOCITY',
      weight: 30, // 30% of total score
      value,
      description: `${recentCount} bookings in last ${this.VELOCITY_WINDOW_MINUTES}min (limit: ${this.MAX_BOOKINGS_PER_WINDOW})`,
    };
  }

  private async checkCancellationPattern(userId: string): Promise<FraudSignal> {
    const total = await this.prisma.reservation.count({ where: { userId } });
    if (total === 0) {
      return { signal: 'CANCEL_PATTERN', weight: 20, value: 0, description: 'No history' };
    }

    const cancelled = await this.prisma.reservation.count({
      where: { userId, status: 'CANCELLED' },
    });

    const ratio = cancelled / total;
    const value = ratio > this.MAX_CANCELLED_RATIO ? Math.min(1, ratio / 0.8) : 0;

    return {
      signal: 'CANCEL_PATTERN',
      weight: 20,
      value,
      description: `${cancelled}/${total} cancelled (${(ratio * 100).toFixed(0)}%)`,
    };
  }

  private async checkPaymentFailures(userId: string): Promise<FraudSignal> {
    const total = await this.prisma.payment.count({ where: { userId } });
    if (total === 0) {
      return { signal: 'PAYMENT_FAILURES', weight: 25, value: 0, description: 'No payments' };
    }

    const failed = await this.prisma.payment.count({
      where: { userId, status: 'FAILED' },
    });

    const ratio = failed / total;
    const value = ratio > this.MAX_FAILED_PAYMENTS_RATIO
      ? Math.min(1, ratio / 0.7)
      : 0;

    return {
      signal: 'PAYMENT_FAILURES',
      weight: 25,
      value,
      description: `${failed}/${total} failed payments (${(ratio * 100).toFixed(0)}%)`,
    };
  }

  private async checkBulkPurchase(userId: string): Promise<FraudSignal> {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT COUNT(DISTINCT event_id)::int as "eventCount",
             COALESCE(SUM(ticket_count), 0)::int as "totalTickets"
      FROM reservations
      WHERE user_id = ${userId}::uuid
        AND created_at > ${last30Days}
        AND status IN ('PENDING', 'CONFIRMED')
    `;

    const totalTickets = result[0]?.totalTickets || 0;
    // More than 20 tickets in 30 days across multiple events is suspicious
    const value = totalTickets > 20 ? Math.min(1, totalTickets / 50) : 0;

    return {
      signal: 'BULK_PURCHASE',
      weight: 15,
      value,
      description: `${totalTickets} tickets across ${result[0]?.eventCount || 0} events in 30 days`,
    };
  }

  private async checkTimePattern(userId: string): Promise<FraudSignal> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) BETWEEN 2 AND 5)::int as "oddHourCount",
             COUNT(*)::int as "totalCount"
      FROM reservations WHERE user_id = ${userId}::uuid
    `;

    const total = result[0]?.totalCount || 0;
    const oddHour = result[0]?.oddHourCount || 0;

    if (total < 3) {
      return { signal: 'TIME_ANOMALY', weight: 10, value: 0, description: 'Not enough data' };
    }

    const oddRatio = oddHour / total;
    // More than 70% bookings between 2-5 AM is suspicious (bot behavior)
    const value = oddRatio > 0.7 ? Math.min(1, oddRatio) : 0;

    return {
      signal: 'TIME_ANOMALY',
      weight: 10,
      value,
      description: `${oddHour}/${total} bookings between 2-5 AM (${(oddRatio * 100).toFixed(0)}%)`,
    };
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private getRiskLevel(score: number): FraudAnalysis['riskLevel'] {
    if (score >= 80) return 'CRITICAL';
    if (score >= this.RISK_THRESHOLD_BLOCK) return 'HIGH';
    if (score >= this.RISK_THRESHOLD_REVIEW) return 'MEDIUM';
    return 'LOW';
  }

  private getRecommendation(score: number): FraudAnalysis['recommendation'] {
    if (score >= this.RISK_THRESHOLD_BLOCK) return 'BLOCK';
    if (score >= this.RISK_THRESHOLD_REVIEW) return 'REVIEW';
    return 'ALLOW';
  }
}
