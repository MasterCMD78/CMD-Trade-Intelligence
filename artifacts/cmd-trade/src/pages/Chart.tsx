/**
 * Chart page — /markets/:symbol
 *
 * Shows a live quote header + OHLCV area/volume chart for a single symbol.
 * Data is fetched via the generated API hooks; candles refresh on timeframe change.
 * Quote auto-refreshes every 30 s.
 */

import React, { useState, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  useGetMarketQuote,
  useGetSymbolCandles,
} from '@workspace/api-client-react';
import type { MarketCandle } from '@workspace/api-client-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

type Timeframe = '1M' | '5M' | '15M' | '30M' | '1H' | '4H' | '1D' | '1W';

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: '1M',  label: '1m'  },
  { value: '5M',  label: '5m'  },
  { value: '15M', label: '15m' },
  { value: '30M', label: '30m' },
  { value: '1H',  label: '1H'  },
  { value: '4H',  label: '4H'  },
  { value: '1D',  label: '1D'  },
  { value: '1W',  label: '1W'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number, precision: number): string {
  return n.toFixed(Math.max(precision, 2));
}

function formatTimestamp(iso: string, timeframe: Timeframe): string {
  const d = new Date(iso);
  if (timeframe === '1D' || timeframe === '1W') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface CandleTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  precision: number;
}

interface ChartRow {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closed: boolean;
}

function CandleTooltip({ active, payload, precision }: CandleTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded px-3 py-2 text-xs font-mono shadow-lg">
      <div className="text-muted-foreground mb-1">{d.timestamp}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-muted-foreground">O</span><span>{formatPrice(d.open, precision)}</span>
        <span className="text-muted-foreground">H</span><span className="text-green-400">{formatPrice(d.high, precision)}</span>
        <span className="text-muted-foreground">L</span><span className="text-red-400">{formatPrice(d.low, precision)}</span>
        <span className="text-muted-foreground">C</span><span className="font-bold">{formatPrice(d.close, precision)}</span>
        <span className="text-muted-foreground">Vol</span><span>{formatVolume(d.volume)}</span>
      </div>
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, highlight }: { label: string; value: string; highlight?: 'up' | 'down' | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono font-semibold ${
        highlight === 'up'   ? 'text-green-400' :
        highlight === 'down' ? 'text-red-400'   : 'text-foreground'
      }`}>
        {value}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Chart() {
  const { symbol } = useParams<{ symbol: string }>();
  const [, navigate] = useLocation();
  const [timeframe, setTimeframe] = useState<Timeframe>('1H');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote, isLoading: quoteLoading, error: quoteError } = useGetMarketQuote(
    symbol ?? '',
    { query: { refetchInterval: 30_000, enabled: !!symbol } as any },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawCandles, isLoading: candlesLoading } = useGetSymbolCandles(
    symbol ?? '',
    timeframe,
    { query: { enabled: !!symbol } as any },
  );

  const precision = quote?.precision ?? 5;

  // Transform candles for recharts
  const chartData: ChartRow[] = useMemo(() => {
    if (!rawCandles) return [];
    return (rawCandles as MarketCandle[]).map((c) => ({
      timestamp:  formatTimestamp(c.timestamp, timeframe),
      open:       c.open,
      high:       c.high,
      low:        c.low,
      close:      c.close,
      volume:     c.volume,
      closed:     c.closed,
    }));
  }, [rawCandles, timeframe]);

  // Price domain with 5% padding
  const priceDomain = useMemo((): [number, number] => {
    if (!chartData.length) return [0, 1];
    const lows  = chartData.map((d) => d.low);
    const highs = chartData.map((d) => d.high);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const pad = (max - min) * 0.05;
    return [min - pad, max + pad];
  }, [chartData]);

  const isUp = (quote?.changePct24h ?? 0) >= 0;

  if (quoteError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-destructive font-mono text-sm">Symbol not found: {symbol}</p>
        <button
          onClick={() => navigate('/markets')}
          className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Markets
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Back nav ── */}
      <button
        onClick={() => navigate('/markets')}
        className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Markets
      </button>

      {/* ── Quote header ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="py-5 px-6">
            {quoteLoading ? (
              <div className="flex gap-8">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            ) : quote ? (
              <div className="flex flex-wrap items-start gap-8">
                {/* Symbol + badge */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-mono font-bold tracking-wider">{quote.symbol}</span>
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] ${
                        quote.assetClass === 'crypto'
                          ? 'border-accent/50 text-accent'
                          : 'border-muted-foreground/40 text-muted-foreground'
                      }`}
                    >
                      {quote.assetClass.toUpperCase()}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{quote.displayName}</span>
                </div>

                {/* Bid / Ask */}
                <StatChip label="Bid" value={formatPrice(quote.bid, precision)} />
                <StatChip label="Ask" value={formatPrice(quote.ask, precision)} />

                {/* Change */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">24h Change</span>
                  <span className={`text-sm font-mono font-semibold flex items-center gap-0.5 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                    {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {isUp ? '+' : ''}{quote.changePct24h.toFixed(2)}%
                  </span>
                </div>

                {/* High / Low */}
                <StatChip label="24h High" value={formatPrice(quote.high24h, precision)} highlight="up" />
                <StatChip label="24h Low"  value={formatPrice(quote.low24h,  precision)} highlight="down" />

                {/* Spread */}
                <StatChip label="Spread" value={formatPrice(quote.spread, precision)} />

                {/* Trading hours */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Hours</span>
                  <span className="text-sm font-mono text-muted-foreground">{quote.tradingHours}</span>
                </div>

                {/* Refresh indicator */}
                <div className="ml-auto flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50 self-end">
                  <RefreshCw className="h-2.5 w-2.5" />
                  auto-refresh 30s
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Timeframe selector ── */}
      <div className="flex items-center gap-1.5">
        {TIMEFRAMES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTimeframe(value)}
            className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
              timeframe === value
                ? 'bg-accent text-background border-accent'
                : 'bg-transparent text-muted-foreground border-border hover:border-accent/40 hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Price chart ── */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-0 pt-4 px-6">
          <CardTitle className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
            Close Price · {timeframe}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 pb-4 px-2">
          {candlesLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--accent))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={priceDomain}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatPrice(v, precision)}
                  width={precision > 4 ? 72 : 60}
                />
                <Tooltip content={<CandleTooltip precision={precision} />} />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="hsl(var(--accent))"
                  strokeWidth={1.5}
                  fill="url(#priceGrad)"
                  dot={false}
                  activeDot={{ r: 3, fill: 'hsl(var(--accent))' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Volume chart ── */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-0 pt-4 px-6">
          <CardTitle className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
            Volume · {timeframe}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 pb-4 px-2">
          {candlesLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatVolume}
                  width={42}
                />
                <Tooltip
                  formatter={(v: number) => [formatVolume(v), 'Volume']}
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <Bar dataKey="volume" fill="hsl(var(--accent))" opacity={0.5} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
