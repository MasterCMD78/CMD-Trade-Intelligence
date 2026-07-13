import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGetMarkets, useGetTimeframes } from '@workspace/api-client-react';
import { useAuth } from '@/context/AuthContext';
import { useMarketWebSocket } from '@/hooks/useMarketWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit, TrendingUp, TrendingDown, Minus,
  RefreshCw, AlertTriangle, CheckCircle, Shield,
  Activity, BarChart2, Layers, Eye, Clock, GitBranch, Zap,
  Droplets, Box, Divide, DollarSign, Newspaper, Lock, CalendarClock,
} from 'lucide-react';

// ─── Types matching the API ───────────────────────────────────────────────────

type Decision = 'BUY' | 'SELL' | 'HOLD';
type RiskLevel = 'low' | 'medium' | 'high';
type TrendDir = 'bullish' | 'bearish' | 'sideways';
type Signal = 'buy' | 'sell' | 'neutral';
type SweepDir = 'buy-side' | 'sell-side';
type PdZone = 'premium' | 'equilibrium' | 'discount';
type FvgStatus = 'active' | 'partial' | 'mitigated';

interface LiquiditySummary {
  levelCount: number;
  sweepCount: number;
  lastSweepDirection: SweepDir | null;
  lastSweepRejection: number | null;
  lastSweepConfidence: number | null;
  lastSweepPrice: number | null;
}

interface OrderBlockSummary {
  activeCount: number;
  lastBullishHigh: number | null;
  lastBullishLow: number | null;
  lastBullishConfidence: number | null;
  lastBullishMitigated: boolean;
  lastBearishHigh: number | null;
  lastBearishLow: number | null;
  lastBearishConfidence: number | null;
  lastBearishMitigated: boolean;
}

interface FairValueGapSummary {
  activeCount: number;
  lastBullishGapHigh: number | null;
  lastBullishGapLow: number | null;
  lastBullishStatus: FvgStatus | null;
  lastBullishFillPct: number | null;
  lastBearishGapHigh: number | null;
  lastBearishGapLow: number | null;
  lastBearishStatus: FvgStatus | null;
  lastBearishFillPct: number | null;
}

interface PremiumDiscountSummary {
  available: boolean;
  currentZone: PdZone | null;
  pricePosition: number | null;
  equilibrium: number | null;
  rangeHigh: number | null;
  rangeLow: number | null;
}

// ─── Multi-Timeframe types (Phase 3H) ─────────────────────────────────────────

type MTFKey = 'm1' | 'm5' | 'm15' | 'm30' | 'h1' | 'h4' | 'daily' | 'weekly';

const MTF_LABELS: Record<MTFKey, string> = {
  weekly: 'Weekly', daily: 'Daily', h4: 'H4', h1: 'H1',
  m30: 'M30', m15: 'M15', m5: 'M5', m1: 'M1',
};
const MTF_ORDER: MTFKey[] = ['weekly', 'daily', 'h4', 'h1', 'm30', 'm15', 'm5', 'm1'];

type AlignmentType =
  | 'full_bullish' | 'full_bearish' | 'internal_pullback' | 'external_trend'
  | 'internal_trend' | 'trend_conflict' | 'mixed' | 'neutral';

type InstitutionalBias = 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';

interface ChochSummary {
  detected: boolean;
  direction: 'bullish' | 'bearish' | null;
  confidence: number | null;
}

interface TimeframeSnapshot {
  candleCount: number;
  trend: TrendDir;
  marketPhase: 'trending' | 'ranging' | 'reversal';
  bos: { detected: boolean; direction: 'bullish' | 'bearish' | null; price: number | null; strength: number | null; confidence: number | null };
  choch: ChochSummary;
  liquidity: LiquiditySummary;
  orderBlocks: OrderBlockSummary;
  fairValueGaps: FairValueGapSummary;
  premiumDiscount: PremiumDiscountSummary;
  swingHigh: number | null;
  swingLow: number | null;
}

interface MultiTimeframeResult {
  timeframes: Partial<Record<MTFKey, TimeframeSnapshot>>;
  reasons: string[];
  availableCount: number;
  alignmentType: AlignmentType;
  alignmentScore: number;
  higherTimeframeBias: InstitutionalBias;
  intermediateBias: InstitutionalBias;
  lowerTimeframeBias: InstitutionalBias;
  overallBias: InstitutionalBias;
  institutionalBias: InstitutionalBias;
  confluenceScore: number;
  confidenceAdjustment: number;
}

interface AnalysisResult {
  symbol: string;
  timeframe: string;
  timestamp: string;
  candleCount: number;
  decision: Decision;
  confidence: number;
  riskLevel: RiskLevel;
  trend: TrendDir;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  indicators: {
    rsi:           { value: number; signal: Signal; overbought: boolean; oversold: boolean };
    macd:          { macdLine: number; signalLine: number; histogram: number; crossover: string; signal: Signal };
    ema:           { ema20: number; ema50: number; ema200: number; trend: TrendDir; signal: Signal; priceAboveEma20: boolean; priceAboveEma50: boolean; priceAboveEma200: boolean };
    sma:           { sma20: number; sma50: number };
    bollingerBands:{ upper: number; middle: number; lower: number; pctB: number; width: number; signal: Signal };
    atr:           { value: number; pctOfPrice: number; volatility: string };
    adx:           { adx: number; plusDI: number; minusDI: number; trending: boolean; signal: Signal };
    stochasticRsi: { k: number; d: number; signal: Signal; overbought: boolean; oversold: boolean };
    volume:        { current: number; average: number; ratio: number; spike: boolean; trend: string; signal: Signal };
    trend:         { shortTerm: TrendDir; mediumTerm: TrendDir; longTerm: TrendDir; overall: TrendDir; signal: Signal };
    supportResistance: { supports: number[]; resistances: number[]; nearestSupport: number | null; nearestResistance: number | null };
  };
  patterns: Array<{ name: string; type: 'bullish' | 'bearish' | 'neutral'; strength: number; description: string }>;
  reasons: string[];
  marketStructure: {
    marketTrend: TrendDir;
    structureDirection: TrendDir;
    latestSwing: 'HH' | 'HL' | 'LH' | 'LL' | null;
    swingHigh: number | null;
    swingLow: number | null;
    marketPhase: 'trending' | 'ranging' | 'reversal';
    bos: {
      detected: boolean;
      direction: 'bullish' | 'bearish' | null;
      price: number | null;
      strength: number | null;
      confidence: number | null;
    };
    liquidity: LiquiditySummary;
    orderBlocks: OrderBlockSummary;
    fairValueGaps: FairValueGapSummary;
    premiumDiscount: PremiumDiscountSummary;
  };
  multiTimeframe?: MultiTimeframeResult;
  decisionEngine: DecisionEngineResult;
  news: NewsAnalysisResult;
}

// ─── Economic News & Fundamental Intelligence types (Phase 5) ────────────────

type EventImpact = 'high' | 'medium' | 'low';
type EventCategory =
  | 'CPI' | 'CORE_CPI' | 'NFP' | 'FOMC' | 'INTEREST_RATE' | 'GDP'
  | 'RETAIL_SALES' | 'UNEMPLOYMENT' | 'PMI' | 'PPI' | 'CENTRAL_BANK_SPEECH' | 'OTHER';
type FundamentalBias = 'bullish' | 'bearish' | 'neutral' | 'unknown';
type NewsRisk = 'low' | 'medium' | 'high' | 'extreme';
type TradingRestriction = 'SAFE' | 'CAUTION' | 'NO_TRADE' | 'LOCK_TRADING';
type NewsRecommendation = 'PROCEED' | 'CAUTION' | 'WAIT' | 'AVOID';

interface EconomicEvent {
  id: string;
  name: string;
  category: EventCategory;
  currency: string;
  country: string;
  impact: EventImpact;
  scheduledTime: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
}

interface NewsWindow {
  minutesUntil: number | null;
  hoursUntil: number | null;
  isWarning: boolean;
  isLocked: boolean;
}

interface NewsAnalysisResult {
  symbol: string;
  currentEvent: EconomicEvent | null;
  nextEvent: EconomicEvent | null;
  minutesRemaining: number | null;
  hoursRemaining: number | null;
  severity: EventImpact | null;
  fundamentalBias: FundamentalBias;
  newsConfidence: number;
  riskLevel: NewsRisk;
  tradingRestriction: TradingRestriction;
  recommendation: NewsRecommendation;
  affectedCurrencies: string[];
  window: NewsWindow;
  activeEvents: EconomicEvent[];
}

// ─── Institutional Decision Engine types (Phase 4) ────────────────────────────

type InstitutionalDecision = 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
type TradeGrade = 'A+' | 'A' | 'B' | 'C' | 'D';
type MarketState = 'trending' | 'ranging' | 'accumulation' | 'distribution' | 'reversal' | 'expansion' | 'consolidation';

interface ScoreBreakdown {
  name: string;
  score: number;
  confidence: number;
  explanation: string;
  displayScore: number;
  weight: number;
}

interface ConfidenceBundle {
  overallConfidence: number;
  institutionalScore: number;
  decisionConfidence: number;
  riskConfidence: number;
}

interface DecisionRiskPlan {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  positionSize: number;
  maxRiskPct: number;
  tradeManagement: string;
}

interface DecisionEngineResult {
  decision: InstitutionalDecision;
  institutionalScore: number;
  tradeGrade: TradeGrade;
  confidence: ConfidenceBundle;
  marketState: MarketState;
  riskLevel: RiskLevel;
  risk: DecisionRiskPlan;
  reasons: string[];
  breakdown: ScoreBreakdown[];
}

// ─── Fetch hook ───────────────────────────────────────────────────────────────

function useAnalysis(symbol: string, timeframe: string, enabled: boolean) {
  const { token } = useAuth();
  return useQuery<AnalysisResult>({
    queryKey: ['analysis', symbol, timeframe],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/${symbol}?timeframe=${timeframe}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<AnalysisResult>;
    },
    enabled: enabled && !!token && !!symbol,
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

// ─── Visual helpers ───────────────────────────────────────────────────────────

const DECISION_CONFIG = {
  BUY:  { label: 'BUY',  color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', icon: TrendingUp },
  SELL: { label: 'SELL', color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/30',         icon: TrendingDown },
  HOLD: { label: 'HOLD', color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-400/30',   icon: Minus },
} as const;

const RISK_CONFIG = {
  low:    { label: 'Low Risk',    color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
  medium: { label: 'Medium Risk', color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-400/30' },
  high:   { label: 'High Risk',   color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/30' },
} as const;

const TREND_CONFIG = {
  bullish:  { label: 'Bullish',  color: 'text-emerald-400', icon: TrendingUp },
  bearish:  { label: 'Bearish',  color: 'text-red-400',     icon: TrendingDown },
  sideways: { label: 'Sideways', color: 'text-yellow-400',  icon: Minus },
} as const;

const INSTITUTIONAL_DECISION_CONFIG = {
  BUY:  { label: 'BUY',  color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', icon: TrendingUp },
  SELL: { label: 'SELL', color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/30',         icon: TrendingDown },
  HOLD: { label: 'HOLD', color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-400/30',   icon: Minus },
  WAIT: { label: 'WAIT', color: 'text-sky-400',     bg: 'bg-sky-400/10 border-sky-400/30',         icon: Clock },
} as const;

const TRADE_GRADE_COLOR: Record<TradeGrade, string> = {
  'A+': 'text-emerald-400',
  A:    'text-emerald-400/80',
  B:    'text-yellow-400',
  C:    'text-orange-400',
  D:    'text-red-400',
};

const MARKET_STATE_LABEL: Record<MarketState, string> = {
  trending:      'Trending',
  ranging:       'Ranging',
  accumulation:  'Accumulation',
  distribution:  'Distribution',
  reversal:      'Reversal',
  expansion:     'Expansion',
  consolidation: 'Consolidation',
};

const RESTRICTION_CONFIG: Record<TradingRestriction, { label: string; color: string; bg: string; icon: typeof Shield }> = {
  SAFE:         { label: 'Safe to Trade', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', icon: CheckCircle },
  CAUTION:      { label: 'Caution',       color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-400/30',   icon: AlertTriangle },
  NO_TRADE:     { label: 'No Trade',      color: 'text-orange-400',  bg: 'bg-orange-400/10 border-orange-400/30',   icon: AlertTriangle },
  LOCK_TRADING: { label: 'Trading Locked', color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/30',         icon: Lock },
};

const NEWS_RISK_COLOR: Record<NewsRisk, string> = {
  low: 'text-emerald-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  extreme: 'text-red-400',
};

const BIAS_CONFIG: Record<FundamentalBias, { label: string; color: string }> = {
  bullish: { label: 'Bullish', color: 'text-emerald-400' },
  bearish: { label: 'Bearish', color: 'text-red-400' },
  neutral: { label: 'Neutral', color: 'text-muted-foreground' },
  unknown: { label: 'No Data', color: 'text-muted-foreground' },
};

const IMPACT_COLOR: Record<EventImpact, string> = {
  high: 'text-red-400',
  medium: 'text-yellow-400',
  low: 'text-muted-foreground',
};

function formatEventTiming(minutes: number | null): string {
  if (minutes === null) return '—';
  const abs = Math.abs(minutes);
  const label = abs < 60 ? `${Math.round(abs)}m` : `${(abs / 60).toFixed(1)}h`;
  return minutes >= 0 ? `in ${label}` : `${label} ago`;
}

function formatEventCategory(category: EventCategory): string {
  return category.replace(/_/g, ' ');
}

const SIGNAL_COLOR: Record<Signal, string> = {
  buy:     'text-emerald-400',
  sell:    'text-red-400',
  neutral: 'text-muted-foreground',
};

function signalBadge(signal: Signal) {
  const labels: Record<Signal, string> = { buy: 'BUY', sell: 'SELL', neutral: 'NEUTRAL' };
  return (
    <span className={`font-mono text-xs font-semibold ${SIGNAL_COLOR[signal]}`}>
      {labels[signal]}
    </span>
  );
}

function formatPrice(n: number, decimals = 5) {
  if (n === undefined || n === null) return '—';
  return n.toFixed(decimals);
}

function pct(n: number) { return `${(n * 100).toFixed(2)}%`; }

// ─── Confidence gauge ─────────────────────────────────────────────────────────

function ConfidenceGauge({ value, decision }: { value: number; decision: Decision }) {
  const color =
    decision === 'BUY'  ? '#34d399' :
    decision === 'SELL' ? '#f87171' : '#facc15';
  const r = 36, cx = 44, cy = 44;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * (value / 100);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={88} height={88} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={8} />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <span className="font-mono text-2xl font-bold -mt-14" style={{ color }}>{value}%</span>
      <span className="font-mono text-xs text-muted-foreground mt-8">Confidence</span>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono text-lg font-bold ${accent ?? 'text-foreground'}`}>{value}</span>
      {sub && <span className="font-mono text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── Indicator row ────────────────────────────────────────────────────────────

function IndRow({ label, value, signal, extra }: { label: string; value: string; signal?: Signal; extra?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 last:border-0">
      <span className="font-mono text-xs text-muted-foreground w-40 shrink-0">{label}</span>
      <span className="font-mono text-xs font-semibold text-foreground text-right">{value}</span>
      {signal && (
        <span className="ml-4 min-w-16 text-right">{signalBadge(signal)}</span>
      )}
      {extra && (
        <span className="ml-4 font-mono text-xs text-muted-foreground text-right">{extra}</span>
      )}
    </div>
  );
}

// ─── Trend pill ───────────────────────────────────────────────────────────────

function TrendPill({ dir }: { dir: TrendDir }) {
  const cfg = TREND_CONFIG[dir];
  const Icon = cfg.icon;
  return (
    <span className={`flex items-center gap-1 font-mono text-xs ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5" />{cfg.label}
    </span>
  );
}

// ─── Strength bar ─────────────────────────────────────────────────────────────

function StrengthBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

// ─── Empty zone pill ──────────────────────────────────────────────────────────

function NoneDetected({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-muted/20 rounded-lg border border-border/50">
      <Minus className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="font-mono text-sm text-muted-foreground">{message}</span>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function AnalysisSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

// ─── Main Analysis page ───────────────────────────────────────────────────────

export default function Analysis() {
  const [symbol, setSymbol]     = useState('EURUSD');
  const [timeframe, setTimeframe] = useState('1H');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secsAgo, setSecsAgo]   = useState(0);

  const { data: symbolList = [] } = useGetMarkets({});
  const { data: tfData }          = useGetTimeframes();

  const { ticks } = useMarketWebSocket([symbol], true);
  const tick = ticks[symbol];

  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useAnalysis(
    symbol, timeframe, autoRefresh,
  );

  useEffect(() => {
    if (!dataUpdatedAt) return;
    const interval = setInterval(() => {
      setSecsAgo(Math.floor((Date.now() - dataUpdatedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  const handleRefresh = useCallback(() => { void refetch(); }, [refetch]);

  const timeframes = tfData?.timeframes ?? [];

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Symbol</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="bg-muted border border-border text-foreground font-mono text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {symbolList.length === 0
                  ? <option value={symbol}>{symbol}</option>
                  : symbolList.map((s: { symbol: string; displayName: string; assetClass: string }) => (
                      <option key={s.symbol} value={s.symbol}>{s.displayName} ({s.assetClass})</option>
                    ))
                }
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Timeframe</span>
              <div className="flex gap-1 flex-wrap">
                {(timeframes.length > 0 ? timeframes : [{ value: '1H' }]).map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => setTimeframe(tf.value)}
                    className={`px-2.5 py-1.5 text-xs font-mono rounded border transition-colors ${
                      timeframe === tf.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {tf.value}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 sm:ml-auto">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">Auto</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoRefresh}
                  aria-label="Toggle auto-refresh"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`w-9 h-5 rounded-full transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    autoRefresh ? 'bg-primary' : 'bg-muted border border-border'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoRefresh ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <button
                onClick={handleRefresh}
                disabled={isLoading || isFetching}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-xs font-mono rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                Analyze
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
            {tick && (
              <span className="font-mono text-xs text-muted-foreground">
                Live: <span className="text-emerald-400">{tick.bid.toFixed(5)}</span>
                <span className="text-muted-foreground/50 mx-1">/</span>
                <span className="text-accent">{tick.ask.toFixed(5)}</span>
              </span>
            )}
            {dataUpdatedAt > 0 && (
              <span className="font-mono text-xs text-muted-foreground">
                <Clock className="h-3 w-3 inline mr-1" />
                Updated {secsAgo}s ago
              </span>
            )}
            {isFetching && (
              <span className="font-mono text-xs text-primary animate-pulse">
                <Activity className="h-3 w-3 inline mr-1" />
                Analyzing…
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {error && !isLoading && (
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="font-mono text-sm text-destructive">{(error as Error).message}</p>
          </CardContent>
        </Card>
      )}

      {isLoading && !data && <AnalysisSkeleton />}

      <AnimatePresence mode="wait">
        {data && (
          <motion.div
            key={`${data.symbol}-${data.timeframe}-${data.timestamp}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* ── Decision hero row ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className={`md:col-span-1 border ${DECISION_CONFIG[data.decision].bg}`}>
                <CardContent className="pt-5 pb-4 flex flex-col items-center gap-3">
                  {(() => {
                    const cfg = DECISION_CONFIG[data.decision];
                    const Icon = cfg.icon;
                    return (
                      <>
                        <div className={`flex items-center gap-3 ${cfg.color}`}>
                          <Icon className="h-8 w-8" />
                          <span className="font-bold text-4xl tracking-tight">{cfg.label}</span>
                        </div>
                        <ConfidenceGauge value={data.confidence} decision={data.decision} />
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card className="md:col-span-2 bg-card border-border">
                <CardContent className="pt-5 pb-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Trend</span>
                      <TrendPill dir={data.trend} />
                      <span className="font-mono text-xs text-muted-foreground mt-1">
                        S: <TrendPill dir={data.indicators.trend.shortTerm} />
                      </span>
                    </div>
                    <div className={`flex flex-col gap-0.5 p-4 rounded-lg border ${RISK_CONFIG[data.riskLevel].bg}`}>
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Risk Level</span>
                      <span className={`font-mono text-lg font-bold ${RISK_CONFIG[data.riskLevel].color}`}>
                        {RISK_CONFIG[data.riskLevel].label}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">ATR: {pct(data.indicators.atr.pctOfPrice)}</span>
                    </div>
                    <StatCard label="Entry Price" value={formatPrice(data.entryPrice)} />
                    <StatCard label="Stop Loss"   value={formatPrice(data.stopLoss)}   accent="text-red-400" />
                    <StatCard label="Take Profit" value={formatPrice(data.takeProfit)} accent="text-emerald-400" />
                    <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border col-span-2 sm:col-span-3">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Risk : Reward</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xl font-bold">1 : {data.riskRewardRatio.toFixed(2)}</span>
                        {data.riskRewardRatio >= 2 && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                        {data.riskRewardRatio < 1.2 && data.decision !== 'HOLD' && (
                          <AlertTriangle className="h-4 w-4 text-yellow-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Institutional Decision Engine (Phase 4) ── */}
            {(() => {
              const de = data.decisionEngine;
              const cfg = INSTITUTIONAL_DECISION_CONFIG[de.decision];
              const Icon = cfg.icon;
              const isActive = de.decision === 'BUY' || de.decision === 'SELL';
              return (
                <Card className={`bg-card border ${cfg.bg}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <BrainCircuit className="h-4 w-4 text-primary" />
                      Institutional Decision Engine — combined score across every module
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                      <div className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border ${cfg.bg}`}>
                        <div className={`flex items-center gap-2 ${cfg.color}`}>
                          <Icon className="h-6 w-6" />
                          <span className="font-bold text-2xl tracking-tight">{cfg.label}</span>
                        </div>
                        <span className={`font-mono text-xs font-semibold ${TRADE_GRADE_COLOR[de.tradeGrade]}`}>
                          Grade {de.tradeGrade}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 p-4 bg-muted/30 rounded-lg border border-border">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Institutional Score</span>
                        <span className={`font-mono text-2xl font-bold ${cfg.color}`}>{de.institutionalScore}<span className="text-sm text-muted-foreground">/100</span></span>
                        <StrengthBar value={de.institutionalScore / 100} color={de.institutionalScore >= 65 ? 'bg-emerald-400' : de.institutionalScore >= 45 ? 'bg-yellow-400' : 'bg-red-400'} />
                      </div>

                      <div className="flex flex-col gap-1 p-4 bg-muted/30 rounded-lg border border-border">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Market State</span>
                        <span className="font-mono text-lg font-bold text-foreground">{MARKET_STATE_LABEL[de.marketState]}</span>
                        <span className="font-mono text-xs text-muted-foreground capitalize">{de.riskLevel} risk environment</span>
                      </div>

                      <div className="flex flex-col gap-1 p-4 bg-muted/30 rounded-lg border border-border">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Overall Confidence</span>
                        <span className="font-mono text-2xl font-bold text-foreground">{de.confidence.overallConfidence}%</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          Decision {de.confidence.decisionConfidence}% · Risk {de.confidence.riskConfidence}%
                        </span>
                      </div>
                    </div>

                    {/* Risk plan */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <StatCard label="Entry" value={isActive ? formatPrice(de.risk.entry) : '—'} />
                      <StatCard label="Stop Loss" value={isActive ? formatPrice(de.risk.stopLoss) : '—'} accent="text-red-400" />
                      <StatCard label="TP1" value={isActive ? formatPrice(de.risk.takeProfit1) : '—'} accent="text-emerald-400" />
                      <StatCard label="TP2" value={isActive ? formatPrice(de.risk.takeProfit2) : '—'} accent="text-emerald-400" />
                      <StatCard label="TP3" value={isActive ? formatPrice(de.risk.takeProfit3) : '—'} accent="text-emerald-400" />
                      <StatCard
                        label="Position Size"
                        value={isActive ? `${de.risk.positionSize}%` : '—'}
                        sub={isActive ? `Risk ${de.risk.maxRiskPct}% · RR 1:${de.risk.riskRewardRatio.toFixed(2)}` : undefined}
                      />
                    </div>
                    {isActive && (
                      <div className="flex items-start gap-3 px-4 py-3 bg-muted/20 rounded-lg border border-border/50">
                        <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="font-mono text-xs text-muted-foreground">{de.risk.tradeManagement}</span>
                      </div>
                    )}

                    {/* Score breakdown */}
                    <div className="space-y-2">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Decision Breakdown — per-module contribution</span>
                      <div className="space-y-1.5">
                        {de.breakdown.map((b) => {
                          const dirColor = b.score > 0.05 ? 'text-emerald-400' : b.score < -0.05 ? 'text-red-400' : 'text-muted-foreground';
                          const barColor = b.score > 0.05 ? 'bg-emerald-400' : b.score < -0.05 ? 'bg-red-400' : 'bg-muted-foreground';
                          return (
                            <div key={b.name} className="flex items-center gap-3 py-1.5 px-3 rounded-md bg-muted/10">
                              <span className="font-mono text-xs text-muted-foreground w-32 shrink-0">{b.name}</span>
                              <div className="flex-1">
                                <StrengthBar value={b.displayScore / 100} color={barColor} />
                              </div>
                              <span className={`font-mono text-xs font-semibold w-12 text-right ${dirColor}`}>{b.displayScore}%</span>
                              <span className="font-mono text-xs text-muted-foreground w-12 text-right shrink-0">w={b.weight.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Reasons */}
                    <ul className="space-y-1.5 pt-2 border-t border-border/50">
                      {de.reasons.map((reason, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <span className="font-mono text-xs text-primary mt-0.5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                          <span className="text-foreground/80">{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })()}

            {/* ── Economic News & Fundamental Intelligence (Phase 5) ── */}
            {(() => {
              const news = data.news;
              const rCfg = RESTRICTION_CONFIG[news.tradingRestriction];
              const RIcon = rCfg.icon;
              const bCfg = BIAS_CONFIG[news.fundamentalBias];
              return (
                <Card className={`bg-card border ${rCfg.bg}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Newspaper className="h-4 w-4 text-primary" />
                      Economic News &amp; Fundamental Intelligence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                      <div className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border ${rCfg.bg}`}>
                        <div className={`flex items-center gap-2 ${rCfg.color}`}>
                          <RIcon className="h-6 w-6" />
                          <span className="font-bold text-lg tracking-tight">{rCfg.label}</span>
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">{news.recommendation}</span>
                      </div>

                      <div className="flex flex-col gap-1 p-4 bg-muted/30 rounded-lg border border-border">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Fundamental Bias</span>
                        <span className={`font-mono text-2xl font-bold ${bCfg.color}`}>{bCfg.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {news.affectedCurrencies.length > 0 ? news.affectedCurrencies.join(' / ') : '—'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 p-4 bg-muted/30 rounded-lg border border-border">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">News Confidence</span>
                        <span className="font-mono text-2xl font-bold text-foreground">{news.newsConfidence}<span className="text-sm text-muted-foreground">/100</span></span>
                        <StrengthBar value={news.newsConfidence / 100} color={news.newsConfidence >= 65 ? 'bg-red-400' : news.newsConfidence >= 35 ? 'bg-yellow-400' : 'bg-emerald-400'} />
                      </div>

                      <div className="flex flex-col gap-1 p-4 bg-muted/30 rounded-lg border border-border">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">News Risk</span>
                        <span className={`font-mono text-lg font-bold capitalize ${NEWS_RISK_COLOR[news.riskLevel]}`}>{news.riskLevel}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {news.window.isLocked ? 'Inside lock window' : news.window.isWarning ? 'Inside warning window' : 'Outside warning window'}
                        </span>
                      </div>
                    </div>

                    {/* Current / next event */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className={`p-4 rounded-lg border ${news.currentEvent ? 'bg-red-400/5 border-red-400/30' : 'bg-muted/20 border-border/50'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Event</span>
                          {news.currentEvent && (
                            <span className={`font-mono text-xs font-semibold uppercase ${IMPACT_COLOR[news.currentEvent.impact]}`}>{news.currentEvent.impact}</span>
                          )}
                        </div>
                        {news.currentEvent ? (
                          <>
                            <span className="font-mono text-sm font-bold text-foreground block">{news.currentEvent.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {news.currentEvent.currency} · {formatEventCategory(news.currentEvent.category)} · {formatEventTiming(news.minutesRemaining)}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">No active event for this symbol's currencies.</span>
                        )}
                      </div>

                      <div className="p-4 rounded-lg border bg-muted/20 border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" /> Next Event
                          </span>
                          {news.nextEvent && (
                            <span className={`font-mono text-xs font-semibold uppercase ${IMPACT_COLOR[news.nextEvent.impact]}`}>{news.nextEvent.impact}</span>
                          )}
                        </div>
                        {news.nextEvent ? (
                          <>
                            <span className="font-mono text-sm font-bold text-foreground block">{news.nextEvent.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {news.nextEvent.currency} · {formatEventCategory(news.nextEvent.category)} · {formatEventTiming(news.hoursRemaining !== null ? news.hoursRemaining * 60 : null)}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">No upcoming event scheduled.</span>
                        )}
                      </div>
                    </div>

                    {/* Active events list */}
                    {news.activeEvents.length > 0 && (
                      <div className="space-y-2">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">All Active Events — inside the warning window</span>
                        <div className="space-y-1.5">
                          {news.activeEvents.map((ev) => (
                            <div key={ev.id} className="flex items-center gap-3 py-1.5 px-3 rounded-md bg-muted/10">
                              <span className={`font-mono text-xs font-semibold uppercase w-14 shrink-0 ${IMPACT_COLOR[ev.impact]}`}>{ev.impact}</span>
                              <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">{ev.currency}</span>
                              <span className="font-mono text-xs text-foreground/80 flex-1 truncate">{ev.name}</span>
                              <span className="font-mono text-xs text-muted-foreground shrink-0">
                                {ev.actual !== null ? `A: ${ev.actual}` : ev.forecast !== null ? `F: ${ev.forecast}` : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* ── Market Structure ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  Market Structure — swing-based, indicator-free
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Market Trend</span>
                    <TrendPill dir={data.marketStructure.marketTrend} />
                  </div>
                  <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Structure Dir.</span>
                    <TrendPill dir={data.marketStructure.structureDirection} />
                  </div>
                  <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Latest Swing</span>
                    <span className={`font-mono text-lg font-bold ${
                      data.marketStructure.latestSwing === 'HH' || data.marketStructure.latestSwing === 'HL' ? 'text-emerald-400' :
                      data.marketStructure.latestSwing === 'LH' || data.marketStructure.latestSwing === 'LL' ? 'text-red-400' :
                      'text-muted-foreground'
                    }`}>
                      {data.marketStructure.latestSwing ?? '—'}
                    </span>
                  </div>
                  <StatCard label="Swing High" value={data.marketStructure.swingHigh !== null ? formatPrice(data.marketStructure.swingHigh) : '—'} accent="text-emerald-400" />
                  <StatCard label="Swing Low"  value={data.marketStructure.swingLow  !== null ? formatPrice(data.marketStructure.swingLow)  : '—'} accent="text-red-400" />
                  <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Market Phase</span>
                    <span className={`font-mono text-lg font-bold capitalize ${
                      data.marketStructure.marketPhase === 'trending' ? 'text-emerald-400' :
                      data.marketStructure.marketPhase === 'reversal' ? 'text-yellow-400' :
                      'text-muted-foreground'
                    }`}>
                      {data.marketStructure.marketPhase}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Break of Structure ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Break of Structure — close-confirmed swing breaks
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {data.marketStructure.bos.detected ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className={`flex flex-col gap-0.5 p-4 rounded-lg border ${
                      data.marketStructure.bos.direction === 'bullish' ? 'bg-emerald-400/5 border-emerald-400/30' : 'bg-red-400/5 border-red-400/30'
                    }`}>
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">BOS Status</span>
                      <span className={`font-mono text-lg font-bold ${data.marketStructure.bos.direction === 'bullish' ? 'text-emerald-400' : 'text-red-400'}`}>Confirmed</span>
                    </div>
                    <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Direction</span>
                      <TrendPill dir={data.marketStructure.bos.direction ?? 'sideways'} />
                    </div>
                    <StatCard label="Break Price" value={data.marketStructure.bos.price !== null ? formatPrice(data.marketStructure.bos.price) : '—'} accent={data.marketStructure.bos.direction === 'bullish' ? 'text-emerald-400' : 'text-red-400'} />
                    <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Strength</span>
                      <span className="font-mono text-lg font-bold">
                        {data.marketStructure.bos.strength !== null ? `${(data.marketStructure.bos.strength * 100).toFixed(0)}%` : '—'}
                      </span>
                      {data.marketStructure.bos.strength !== null && (
                        <StrengthBar value={data.marketStructure.bos.strength} color={data.marketStructure.bos.direction === 'bullish' ? 'bg-emerald-400' : 'bg-red-400'} />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Confidence</span>
                      <span className="font-mono text-lg font-bold">
                        {data.marketStructure.bos.confidence !== null ? `${data.marketStructure.bos.confidence}%` : '—'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <NoneDetected message="No Break of Structure detected — price has not closed beyond any confirmed swing level." />
                )}
              </CardContent>
            </Card>

            {/* ── Liquidity (Phase 3D) ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-primary" />
                  Liquidity — equal highs/lows & sweep detection
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {(() => {
                  const liq = data.marketStructure.liquidity;
                  const hasSweep = liq.sweepCount > 0;
                  return hasSweep ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      <div className={`flex flex-col gap-0.5 p-4 rounded-lg border ${
                        liq.lastSweepDirection === 'buy-side' ? 'bg-red-400/5 border-red-400/30' : 'bg-emerald-400/5 border-emerald-400/30'
                      }`}>
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Last Sweep</span>
                        <span className={`font-mono text-lg font-bold ${liq.lastSweepDirection === 'buy-side' ? 'text-red-400' : 'text-emerald-400'}`}>
                          {liq.lastSweepDirection === 'buy-side' ? 'Buy-Side' : 'Sell-Side'}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground capitalize">
                          {liq.lastSweepDirection === 'buy-side' ? 'Bearish rejection' : 'Bullish rejection'}
                        </span>
                      </div>
                      <StatCard label="Sweep Price" value={liq.lastSweepPrice !== null ? formatPrice(liq.lastSweepPrice) : '—'} />
                      <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Rejection</span>
                        <span className="font-mono text-lg font-bold">
                          {liq.lastSweepRejection !== null ? `${(liq.lastSweepRejection * 100).toFixed(0)}%` : '—'}
                        </span>
                        {liq.lastSweepRejection !== null && (
                          <StrengthBar value={liq.lastSweepRejection} color={liq.lastSweepDirection === 'buy-side' ? 'bg-red-400' : 'bg-emerald-400'} />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Confidence</span>
                        <span className="font-mono text-lg font-bold">
                          {liq.lastSweepConfidence !== null ? `${liq.lastSweepConfidence}%` : '—'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Pools / Sweeps</span>
                        <span className="font-mono text-lg font-bold">{liq.levelCount} / {liq.sweepCount}</span>
                        <span className="font-mono text-xs text-muted-foreground">levels swept</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <NoneDetected message={`No confirmed liquidity sweeps — ${liq.levelCount} liquidity pool${liq.levelCount !== 1 ? 's' : ''} tracked.`} />
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* ── Order Blocks (Phase 3E) ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Box className="h-4 w-4 text-primary" />
                  Order Blocks — institutional demand & supply zones
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {(() => {
                  const ob = data.marketStructure.orderBlocks;
                  const hasBull = ob.lastBullishHigh !== null;
                  const hasBear = ob.lastBearishHigh !== null;
                  if (!hasBull && !hasBear) {
                    return <NoneDetected message="No order blocks detected — a confirmed BOS is required to form an order block." />;
                  }
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="font-mono text-xs text-muted-foreground">{ob.activeCount} active zone{ob.activeCount !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {hasBull && (
                          <div className={`p-4 rounded-lg border ${ob.lastBullishMitigated ? 'bg-muted/20 border-border opacity-60' : 'bg-emerald-400/5 border-emerald-400/30'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-xs font-semibold text-emerald-400">Bullish Order Block</span>
                              <Badge variant="outline" className={`font-mono text-xs ${ob.lastBullishMitigated ? 'text-muted-foreground border-muted' : 'text-emerald-400 border-emerald-400/30'}`}>
                                {ob.lastBullishMitigated ? 'Mitigated' : 'Active'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="font-mono text-xs text-muted-foreground block">High</span>
                                <span className="font-mono text-sm font-bold text-emerald-400">{formatPrice(ob.lastBullishHigh!)}</span>
                              </div>
                              <div>
                                <span className="font-mono text-xs text-muted-foreground block">Low</span>
                                <span className="font-mono text-sm font-bold text-emerald-400">{formatPrice(ob.lastBullishLow!)}</span>
                              </div>
                            </div>
                            {ob.lastBullishConfidence !== null && (
                              <div className="mt-2">
                                <span className="font-mono text-xs text-muted-foreground">Confidence: {ob.lastBullishConfidence}%</span>
                                <StrengthBar value={ob.lastBullishConfidence / 100} color="bg-emerald-400" />
                              </div>
                            )}
                          </div>
                        )}
                        {hasBear && (
                          <div className={`p-4 rounded-lg border ${ob.lastBearishMitigated ? 'bg-muted/20 border-border opacity-60' : 'bg-red-400/5 border-red-400/30'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-xs font-semibold text-red-400">Bearish Order Block</span>
                              <Badge variant="outline" className={`font-mono text-xs ${ob.lastBearishMitigated ? 'text-muted-foreground border-muted' : 'text-red-400 border-red-400/30'}`}>
                                {ob.lastBearishMitigated ? 'Mitigated' : 'Active'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="font-mono text-xs text-muted-foreground block">High</span>
                                <span className="font-mono text-sm font-bold text-red-400">{formatPrice(ob.lastBearishHigh!)}</span>
                              </div>
                              <div>
                                <span className="font-mono text-xs text-muted-foreground block">Low</span>
                                <span className="font-mono text-sm font-bold text-red-400">{formatPrice(ob.lastBearishLow!)}</span>
                              </div>
                            </div>
                            {ob.lastBearishConfidence !== null && (
                              <div className="mt-2">
                                <span className="font-mono text-xs text-muted-foreground">Confidence: {ob.lastBearishConfidence}%</span>
                                <StrengthBar value={ob.lastBearishConfidence / 100} color="bg-red-400" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* ── Fair Value Gaps (Phase 3F) ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Divide className="h-4 w-4 text-primary" />
                  Fair Value Gaps — three-candle imbalances
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {(() => {
                  const fvg = data.marketStructure.fairValueGaps;
                  const hasBull = fvg.lastBullishGapHigh !== null;
                  const hasBear = fvg.lastBearishGapHigh !== null;
                  if (!hasBull && !hasBear) {
                    return <NoneDetected message="No fair value gaps detected in the current candle window." />;
                  }
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="font-mono text-xs text-muted-foreground">{fvg.activeCount} active gap{fvg.activeCount !== 1 ? 's' : ''} (unfilled)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {hasBull && (
                          <div className={`p-4 rounded-lg border ${fvg.lastBullishStatus === 'mitigated' ? 'bg-muted/20 border-border opacity-60' : 'bg-emerald-400/5 border-emerald-400/30'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-xs font-semibold text-emerald-400">Bullish FVG</span>
                              <Badge variant="outline" className={`font-mono text-xs capitalize ${
                                fvg.lastBullishStatus === 'active' ? 'text-emerald-400 border-emerald-400/30' :
                                fvg.lastBullishStatus === 'partial' ? 'text-yellow-400 border-yellow-400/30' :
                                'text-muted-foreground border-muted'
                              }`}>
                                {fvg.lastBullishStatus ?? '—'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <span className="font-mono text-xs text-muted-foreground block">Gap High</span>
                                <span className="font-mono text-sm font-bold">{formatPrice(fvg.lastBullishGapHigh!)}</span>
                              </div>
                              <div>
                                <span className="font-mono text-xs text-muted-foreground block">Gap Low</span>
                                <span className="font-mono text-sm font-bold">{formatPrice(fvg.lastBullishGapLow!)}</span>
                              </div>
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">Filled: {fvg.lastBullishFillPct ?? 0}%</span>
                            <StrengthBar value={(fvg.lastBullishFillPct ?? 0) / 100} color="bg-yellow-400" />
                          </div>
                        )}
                        {hasBear && (
                          <div className={`p-4 rounded-lg border ${fvg.lastBearishStatus === 'mitigated' ? 'bg-muted/20 border-border opacity-60' : 'bg-red-400/5 border-red-400/30'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-xs font-semibold text-red-400">Bearish FVG</span>
                              <Badge variant="outline" className={`font-mono text-xs capitalize ${
                                fvg.lastBearishStatus === 'active' ? 'text-red-400 border-red-400/30' :
                                fvg.lastBearishStatus === 'partial' ? 'text-yellow-400 border-yellow-400/30' :
                                'text-muted-foreground border-muted'
                              }`}>
                                {fvg.lastBearishStatus ?? '—'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <span className="font-mono text-xs text-muted-foreground block">Gap High</span>
                                <span className="font-mono text-sm font-bold">{formatPrice(fvg.lastBearishGapHigh!)}</span>
                              </div>
                              <div>
                                <span className="font-mono text-xs text-muted-foreground block">Gap Low</span>
                                <span className="font-mono text-sm font-bold">{formatPrice(fvg.lastBearishGapLow!)}</span>
                              </div>
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">Filled: {fvg.lastBearishFillPct ?? 0}%</span>
                            <StrengthBar value={(fvg.lastBearishFillPct ?? 0) / 100} color="bg-yellow-400" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* ── Premium & Discount (Phase 3G) ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Premium & Discount — swing range positioning
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {(() => {
                  const pd = data.marketStructure.premiumDiscount;
                  if (!pd.available || pd.currentZone === null) {
                    return <NoneDetected message="Not enough swing data to compute premium/discount zones." />;
                  }
                  const zoneColor =
                    pd.currentZone === 'premium' ? 'text-red-400' :
                    pd.currentZone === 'discount' ? 'text-emerald-400' : 'text-yellow-400';
                  const zoneBg =
                    pd.currentZone === 'premium' ? 'bg-red-400/5 border-red-400/30' :
                    pd.currentZone === 'discount' ? 'bg-emerald-400/5 border-emerald-400/30' :
                    'bg-yellow-400/5 border-yellow-400/30';
                  const pos = pd.pricePosition ?? 0;
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className={`flex flex-col gap-0.5 p-4 rounded-lg border ${zoneBg}`}>
                          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Current Zone</span>
                          <span className={`font-mono text-lg font-bold capitalize ${zoneColor}`}>{pd.currentZone}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {pd.currentZone === 'premium' ? 'Look to sell' : pd.currentZone === 'discount' ? 'Look to buy' : 'Neutral'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Position</span>
                          <span className="font-mono text-lg font-bold">{pos}%</span>
                          <span className="font-mono text-xs text-muted-foreground">of swing range</span>
                        </div>
                        <StatCard label="Range High" value={pd.rangeHigh !== null ? formatPrice(pd.rangeHigh) : '—'} accent="text-emerald-400" />
                        <StatCard label="Range Low"  value={pd.rangeLow  !== null ? formatPrice(pd.rangeLow)  : '—'} accent="text-red-400" />
                      </div>

                      {/* Visual range bar */}
                      <div className="px-1">
                        <div className="flex justify-between font-mono text-xs text-muted-foreground mb-1">
                          <span>Discount (0–25%)</span>
                          <span>Equil. ({pd.equilibrium !== null ? formatPrice(pd.equilibrium) : '—'})</span>
                          <span>Premium (75–100%)</span>
                        </div>
                        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                          <div className="absolute inset-y-0 left-0 w-1/4 bg-emerald-400/20 rounded-l-full" />
                          <div className="absolute inset-y-0 right-0 w-1/4 bg-red-400/20 rounded-r-full" />
                          <div
                            className={`absolute top-0.5 h-2 w-2 rounded-full -translate-x-1/2 transition-all ${zoneColor.replace('text-', 'bg-')}`}
                            style={{ left: `${pos}%` }}
                          />
                        </div>
                        <div className="flex justify-between font-mono text-xs text-muted-foreground mt-1">
                          <span>{pd.rangeLow !== null ? formatPrice(pd.rangeLow) : '—'}</span>
                          <span>{pd.rangeHigh !== null ? formatPrice(pd.rangeHigh) : '—'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* ── Multi-Timeframe Structure (Phase 3H) ── */}
            {data.multiTimeframe && (() => {
              const mtf = data.multiTimeframe;
              const biasColor: Record<InstitutionalBias, string> = {
                strong_bullish: 'text-emerald-400',
                bullish:        'text-emerald-400/80',
                neutral:        'text-yellow-400',
                bearish:        'text-red-400/80',
                strong_bearish: 'text-red-400',
              };
              const biasBg: Record<InstitutionalBias, string> = {
                strong_bullish: 'bg-emerald-400/10 border-emerald-400/40',
                bullish:        'bg-emerald-400/5 border-emerald-400/20',
                neutral:        'bg-yellow-400/5 border-yellow-400/20',
                bearish:        'bg-red-400/5 border-red-400/20',
                strong_bearish: 'bg-red-400/10 border-red-400/40',
              };
              const biasLabel: Record<InstitutionalBias, string> = {
                strong_bullish: 'Strong Bullish',
                bullish:        'Bullish',
                neutral:        'Neutral',
                bearish:        'Bearish',
                strong_bearish: 'Strong Bearish',
              };
              const alignmentLabel: Record<AlignmentType, string> = {
                full_bullish:       'Full Bullish Alignment',
                full_bearish:       'Full Bearish Alignment',
                internal_pullback:  'Internal Pullback (Buy Setup)',
                external_trend:     'External Trend (Caution)',
                internal_trend:     'Internal Trend',
                trend_conflict:     'Trend Conflict',
                mixed:              'Mixed Signals',
                neutral:            'Neutral',
              };
              return (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      Multi-Timeframe Structure — institutional alignment & confluence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className={`flex flex-col gap-0.5 p-4 rounded-lg border ${biasBg[mtf.institutionalBias]}`}>
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Institutional Bias</span>
                        <span className={`font-mono text-lg font-bold ${biasColor[mtf.institutionalBias]}`}>
                          {biasLabel[mtf.institutionalBias]}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Alignment</span>
                        <span className="font-mono text-sm font-bold text-foreground">{alignmentLabel[mtf.alignmentType]}</span>
                        <span className="font-mono text-xs text-muted-foreground">Score: {mtf.alignmentScore}/100</span>
                      </div>
                      <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Confluence</span>
                        <span className="font-mono text-lg font-bold">{mtf.confluenceScore}%</span>
                        <StrengthBar value={mtf.confluenceScore / 100} color="bg-primary" />
                      </div>
                      <div className="flex flex-col gap-0.5 p-4 bg-muted/30 rounded-lg border border-border">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Confidence Adj.</span>
                        <span className={`font-mono text-lg font-bold ${mtf.confidenceAdjustment > 0 ? 'text-emerald-400' : mtf.confidenceAdjustment < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                          {mtf.confidenceAdjustment > 0 ? '+' : ''}{mtf.confidenceAdjustment}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{mtf.availableCount}/8 TFs available</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-0.5 p-3 bg-muted/20 rounded-lg border border-border/50">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Higher TF (W/D)</span>
                        <span className={`font-mono text-sm font-bold ${biasColor[mtf.higherTimeframeBias]}`}>{biasLabel[mtf.higherTimeframeBias]}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 p-3 bg-muted/20 rounded-lg border border-border/50">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Intermediate (H4/H1)</span>
                        <span className={`font-mono text-sm font-bold ${biasColor[mtf.intermediateBias]}`}>{biasLabel[mtf.intermediateBias]}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 p-3 bg-muted/20 rounded-lg border border-border/50">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Lower TF</span>
                        <span className={`font-mono text-sm font-bold ${biasColor[mtf.lowerTimeframeBias]}`}>{biasLabel[mtf.lowerTimeframeBias]}</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full font-mono text-xs">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="text-left py-2 pr-3">Timeframe</th>
                            <th className="text-left py-2 pr-3">Trend</th>
                            <th className="text-left py-2 pr-3">Phase</th>
                            <th className="text-left py-2 pr-3">BOS</th>
                            <th className="text-left py-2 pr-3">CHoCH</th>
                            <th className="text-left py-2 pr-3">P&D Zone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MTF_ORDER.map((key) => {
                            const snap = mtf.timeframes[key];
                            if (!snap) {
                              return (
                                <tr key={key} className="border-b border-border/20 opacity-40">
                                  <td className="py-2 pr-3">{MTF_LABELS[key]}</td>
                                  <td colSpan={5} className="py-2 text-muted-foreground">No data</td>
                                </tr>
                              );
                            }
                            return (
                              <tr key={key} className="border-b border-border/20">
                                <td className="py-2 pr-3 font-semibold text-foreground">{MTF_LABELS[key]}</td>
                                <td className="py-2 pr-3"><TrendPill dir={snap.trend} /></td>
                                <td className="py-2 pr-3 capitalize text-muted-foreground">{snap.marketPhase}</td>
                                <td className="py-2 pr-3">
                                  {snap.bos.detected
                                    ? <span className={snap.bos.direction === 'bullish' ? 'text-emerald-400' : 'text-red-400'}>{snap.bos.direction}</span>
                                    : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="py-2 pr-3">
                                  {snap.choch.detected
                                    ? <span className={snap.choch.direction === 'bullish' ? 'text-emerald-400' : 'text-red-400'}>{snap.choch.direction}</span>
                                    : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="py-2 pr-3 capitalize text-muted-foreground">{snap.premiumDiscount.currentZone ?? '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* ── Tabs: Reasons | Indicators | Patterns ── */}
            <Tabs defaultValue="reasons">
              <TabsList className="bg-muted/50 border border-border">
                <TabsTrigger value="reasons"    className="font-mono text-xs">
                  <Eye className="h-3.5 w-3.5 mr-1.5" />Reasons ({data.reasons.length})
                </TabsTrigger>
                <TabsTrigger value="indicators" className="font-mono text-xs">
                  <BarChart2 className="h-3.5 w-3.5 mr-1.5" />Indicators
                </TabsTrigger>
                <TabsTrigger value="patterns"   className="font-mono text-xs">
                  <Layers className="h-3.5 w-3.5 mr-1.5" />Patterns ({data.patterns.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="reasons">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <BrainCircuit className="h-4 w-4 text-primary" />
                      Engine Rationale — {data.symbol} {data.timeframe}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <ul className="space-y-2">
                      {data.reasons.map((reason, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-start gap-3 text-sm"
                        >
                          <span className="font-mono text-xs text-primary mt-0.5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                          <span className="text-foreground/80">{reason}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="indicators">
                <Card className="bg-card border-border">
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/30">
                      <IndRow label="RSI (14)" value={`${data.indicators.rsi.value}`} signal={data.indicators.rsi.signal}
                        extra={data.indicators.rsi.overbought ? 'Overbought' : data.indicators.rsi.oversold ? 'Oversold' : 'Neutral'} />
                      <IndRow label="MACD Line"    value={data.indicators.macd.macdLine.toFixed(6)}    signal={data.indicators.macd.signal} />
                      <IndRow label="MACD Signal"  value={data.indicators.macd.signalLine.toFixed(6)}  extra={data.indicators.macd.crossover !== 'none' ? `${data.indicators.macd.crossover} crossover` : ''} />
                      <IndRow label="MACD Hist"    value={data.indicators.macd.histogram.toFixed(6)} />
                      <IndRow label="EMA 20"  value={formatPrice(data.indicators.ema.ema20)}  extra={data.indicators.ema.priceAboveEma20 ? 'Price above' : 'Price below'} />
                      <IndRow label="EMA 50"  value={formatPrice(data.indicators.ema.ema50)}  extra={data.indicators.ema.priceAboveEma50 ? 'Price above' : 'Price below'} />
                      <IndRow label="EMA 200" value={formatPrice(data.indicators.ema.ema200)} signal={data.indicators.ema.signal} extra={data.indicators.ema.priceAboveEma200 ? 'Price above' : 'Price below'} />
                      <IndRow label="SMA 20" value={formatPrice(data.indicators.sma.sma20)} />
                      <IndRow label="SMA 50" value={formatPrice(data.indicators.sma.sma50)} />
                      <IndRow label="BB Upper"  value={formatPrice(data.indicators.bollingerBands.upper)} />
                      <IndRow label="BB Middle" value={formatPrice(data.indicators.bollingerBands.middle)} />
                      <IndRow label="BB Lower"  value={formatPrice(data.indicators.bollingerBands.lower)} signal={data.indicators.bollingerBands.signal} extra={`%B ${(data.indicators.bollingerBands.pctB * 100).toFixed(0)}%`} />
                      <IndRow label="ATR (14)" value={data.indicators.atr.value.toFixed(6)} extra={`${pct(data.indicators.atr.pctOfPrice)} of price · ${data.indicators.atr.volatility}`} />
                      <IndRow label="ADX (14)" value={`${data.indicators.adx.adx}`} signal={data.indicators.adx.signal} extra={data.indicators.adx.trending ? 'Trending' : 'Ranging'} />
                      <IndRow label="+DI / −DI" value={`${data.indicators.adx.plusDI} / ${data.indicators.adx.minusDI}`} />
                      <IndRow label="StochRSI %K" value={`${data.indicators.stochasticRsi.k}`} signal={data.indicators.stochasticRsi.signal}
                        extra={data.indicators.stochasticRsi.overbought ? 'Overbought' : data.indicators.stochasticRsi.oversold ? 'Oversold' : ''} />
                      <IndRow label="StochRSI %D" value={`${data.indicators.stochasticRsi.d}`} />
                      <IndRow label="Volume"  value={data.indicators.volume.current.toLocaleString()} signal={data.indicators.volume.signal}
                        extra={`${data.indicators.volume.ratio.toFixed(2)}× avg · ${data.indicators.volume.trend}`} />
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
                        <span className="font-mono text-xs text-muted-foreground w-40 shrink-0">Trend (S/M/L)</span>
                        <div className="flex gap-2">
                          <TrendPill dir={data.indicators.trend.shortTerm} />
                          <span className="text-muted-foreground">/</span>
                          <TrendPill dir={data.indicators.trend.mediumTerm} />
                          <span className="text-muted-foreground">/</span>
                          <TrendPill dir={data.indicators.trend.longTerm} />
                        </div>
                      </div>
                      {data.indicators.supportResistance.nearestSupport !== null && (
                        <IndRow label="Nearest Support"    value={formatPrice(data.indicators.supportResistance.nearestSupport)} extra="↑ support" />
                      )}
                      {data.indicators.supportResistance.nearestResistance !== null && (
                        <IndRow label="Nearest Resistance" value={formatPrice(data.indicators.supportResistance.nearestResistance)} extra="↑ resistance" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="patterns">
                <Card className="bg-card border-border">
                  <CardContent className="pt-4 pb-4">
                    {data.patterns.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground font-mono text-sm">
                        No candlestick patterns detected on the last 3 candles.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {data.patterns.map((p, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className={`p-4 rounded-lg border ${
                              p.type === 'bullish' ? 'bg-emerald-400/5 border-emerald-400/20' :
                              p.type === 'bearish' ? 'bg-red-400/5 border-red-400/20' :
                              'bg-muted/30 border-border'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono font-semibold text-sm">{p.name}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`font-mono text-xs ${
                                  p.type === 'bullish' ? 'text-emerald-400 border-emerald-400/30' :
                                  p.type === 'bearish' ? 'text-red-400 border-red-400/30' :
                                  'text-muted-foreground'
                                }`}>
                                  {p.type.toUpperCase()}
                                </Badge>
                                <span className="font-mono text-xs text-muted-foreground">{Math.round(p.strength * 100)}%</span>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{p.description}</p>
                            <StrengthBar value={p.strength} color={p.type === 'bullish' ? 'bg-emerald-400' : p.type === 'bearish' ? 'bg-red-400' : 'bg-muted-foreground'} />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <p className="font-mono text-xs text-muted-foreground text-center">
              Analysis computed from {data.candleCount} × {data.timeframe} candles at {new Date(data.timestamp).toLocaleTimeString()}.
              For informational purposes only — not financial advice.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!data && !isLoading && !error && (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="py-16 text-center">
            <BrainCircuit className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="font-mono text-sm text-muted-foreground">
              Select a symbol and timeframe, then click <strong>Analyze</strong>.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
