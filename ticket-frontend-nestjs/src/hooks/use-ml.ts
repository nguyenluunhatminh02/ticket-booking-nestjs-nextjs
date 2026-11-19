import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

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
  analyzedAt: string;
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
  generatedAt: string;
}

export interface SalesVelocity {
  ticketsPerHour: number;
  ticketsPerDay: number;
  trend: 'ACCELERATING' | 'STEADY' | 'DECELERATING' | 'STALLED';
  trendScore: number;
}

export interface DemandForecast {
  eventId: string;
  eventName: string;
  currentSold: number;
  totalCapacity: number;
  fillRate: number;
  predictedSoldIn24h: number;
  predictedSoldIn72h: number;
  predictedSelloutDate: string | null;
  selloutProbability: number;
  velocity: SalesVelocity;
  recommendations: string[];
  confidence: number;
  modelVersion: string;
  forecastedAt: string;
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

// ─── Fraud Detection Hooks ──────────────────────────────────────────────────

export function useMyFraudCheck() {
  return useQuery<FraudAnalysis>({
    queryKey: ['fraud', 'my'],
    queryFn: async () => {
      const { data } = await apiClient.get('/ml/fraud/check');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUserFraudCheck(userId: string) {
  return useQuery<FraudAnalysis>({
    queryKey: ['fraud', 'user', userId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/ml/fraud/user/${userId}`);
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFraudReport() {
  return useQuery<BulkFraudReport>({
    queryKey: ['fraud', 'report'],
    queryFn: async () => {
      const { data } = await apiClient.get('/ml/fraud/report');
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ─── Demand Forecasting Hooks ───────────────────────────────────────────────

export function useDemandForecast(eventId: string) {
  return useQuery<DemandForecast>({
    queryKey: ['forecast', eventId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/ml/forecast/${eventId}`);
      return data;
    },
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 min
  });
}

export function useDemandHeatmap(eventId: string) {
  return useQuery<DemandHeatmap>({
    queryKey: ['forecast', eventId, 'heatmap'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/ml/forecast/${eventId}/heatmap`);
      return data;
    },
    enabled: !!eventId,
    staleTime: 10 * 60 * 1000,
  });
}

export function usePricingSignals(eventId: string) {
  return useQuery<PricingSignal[]>({
    queryKey: ['pricing', eventId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/ml/pricing/${eventId}`);
      return data;
    },
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000, // Auto-refresh every 3 min
  });
}

// ─── ML Service Status & Training Hooks ─────────────────────────────────────

export interface MlServiceStatus {
  health: { status: string; models?: Record<string, string> };
  models?: Record<string, { exists: boolean; size_kb?: number }>;
  fallback?: string;
}

export function useMlStatus() {
  return useQuery<MlServiceStatus>({
    queryKey: ['ml', 'status'],
    queryFn: async () => {
      const { data } = await apiClient.get('/ml/status');
      return data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useTrainAllModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/ml/train/all');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml'] });
      qc.invalidateQueries({ queryKey: ['fraud'] });
      qc.invalidateQueries({ queryKey: ['forecast'] });
      qc.invalidateQueries({ queryKey: ['pricing'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useTrainFraudModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/ml/train/fraud');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml'] });
      qc.invalidateQueries({ queryKey: ['fraud'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useTrainDemandModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/ml/train/demand');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml'] });
      qc.invalidateQueries({ queryKey: ['forecast'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useTrainPricingModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/ml/train/pricing');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml'] });
      qc.invalidateQueries({ queryKey: ['pricing'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
