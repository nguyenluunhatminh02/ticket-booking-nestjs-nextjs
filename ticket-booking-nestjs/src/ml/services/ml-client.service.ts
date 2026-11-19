import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * HTTP Client for the Python FastAPI ML microservice.
 * 
 * Routes all ML operations (fraud, demand, pricing) to the 
 * separate Python service where scikit-learn models are trained.
 * Falls back to local heuristics if the ML service is unreachable.
 */
@Injectable()
export class MlClientService implements OnModuleInit {
  private readonly logger = new Logger(MlClientService.name);
  private baseUrl: string;
  private isHealthy = false;
  private failureCount = 0;
  private circuitOpenedAt = 0;
  private readonly failureThreshold = 5;
  private readonly circuitCooldownMs = 30_000;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('ML_SERVICE_URL', 'http://localhost:8000/api/ml');
  }

  async onModuleInit() {
    await this.checkHealth();
  }

  // ─── Health ─────────────────────────────────────────────────────────────

  async checkHealth(): Promise<{ status: string; models: Record<string, string> }> {
    try {
      const data = await this.request<any>('GET', '/health');
      this.isHealthy = true;
      this.logger.log('ML Service is healthy');
      return data;
    } catch {
      this.isHealthy = false;
      this.logger.warn('ML Service is unavailable — using local heuristics');
      return { status: 'unavailable', models: {} };
    }
  }

  get available(): boolean {
    return this.isHealthy;
  }

  // ─── Training ─────────────────────────────────────────────────────────────

  async trainAll(): Promise<any> {
    return this.request('POST', '/train/all');
  }

  async trainFraud(): Promise<any> {
    return this.request('POST', '/train/fraud');
  }

  async trainDemand(): Promise<any> {
    return this.request('POST', '/train/demand');
  }

  async trainPricing(): Promise<any> {
    return this.request('POST', '/train/pricing');
  }

  // ─── Fraud Detection ──────────────────────────────────────────────────────

  async analyzeFraud(userId: string): Promise<any> {
    return this.request('GET', `/fraud/analyze/${userId}`);
  }

  async getFraudReport(): Promise<any> {
    return this.request('GET', '/fraud/report');
  }

  // ─── Demand Forecasting ───────────────────────────────────────────────────

  async forecastEvent(eventId: string): Promise<any> {
    return this.request('GET', `/forecast/${eventId}`);
  }

  async getDemandHeatmap(eventId: string): Promise<any> {
    return this.request('GET', `/forecast/${eventId}/heatmap`);
  }

  async getPricingSignals(eventId: string): Promise<any> {
    return this.request('GET', `/pricing/${eventId}`);
  }

  // ─── Dynamic Pricing ─────────────────────────────────────────────────────

  async getTierPrice(eventId: string, tierId: string): Promise<any> {
    return this.request('GET', `/pricing/${eventId}/tier/${tierId}`);
  }

  // ─── Model Status ────────────────────────────────────────────────────────

  async getModelStatus(): Promise<any> {
    return this.request('GET', '/models/status');
  }

  // ─── Internal HTTP helper ─────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    if (
      this.failureCount >= this.failureThreshold &&
      Date.now() - this.circuitOpenedAt < this.circuitCooldownMs
    ) {
      this.isHealthy = false;
      throw new Error('ML Service circuit open — failing fast');
    }

    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutMs = path.includes('/train') ? 300_000 : 10_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = this.configService.get<string>('ML_API_KEY');
      if (apiKey) headers['X-API-Key'] = apiKey;
      const options: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ML Service error ${response.status}: ${errorText}`);
      }

      this.isHealthy = true;
      this.failureCount = 0;
      return response.json() as T;
    } catch (error: any) {
      this.failureCount += 1;
      if (this.failureCount >= this.failureThreshold) {
        this.circuitOpenedAt = Date.now();
      }
      if (error.name === 'AbortError') {
        this.logger.warn(`ML Service request timeout: ${method} ${path}`);
      } else {
        this.logger.warn(`ML Service request failed: ${method} ${path} — ${error.message}`);
      }
      this.isHealthy = false;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
