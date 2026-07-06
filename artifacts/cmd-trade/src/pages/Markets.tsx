import React, { useState } from 'react';
import { useLocation } from 'wouter';
import {
  useGetMarkets,
  useGetTimeframes,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Activity, ChevronRight,
  Globe, BarChart2, Zap, Wifi, WifiOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useMarketWebSocket } from '@/hooks/useMarketWebSocket';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatChange(pct: number): { label: string; positive: boolean } {
  const sign = pct >= 0 ? '+' : '';
  return { label: `${sign}${pct.toFixed(2)}%`, positive: pct >= 0 };
}

function formatPrice(n: number, precision: number): string {
  return n.toFixed(precision);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: boolean;
}
function StatCard({ title, value, icon, accent }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
            {title}
          </CardTitle>
          <span className={accent ? 'text-accent' : 'text-muted-foreground'}>{icon}</span>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold font-mono tracking-tight ${accent ? 'text-accent' : ''}`}>
            {value}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

type AssetFilter = 'all' | 'forex' | 'crypto';

// ─── WS status badge ──────────────────────────────────────────────────────────

function WsStatusBadge({ status }: { status: 'connecting' | 'connected' | 'disconnected' | 'error' }) {
  const map = {
    connecting:   { label: 'Connecting…', color: 'text-yellow-400', Icon: Wifi },
    connected:    { label: 'Live',        color: 'text-accent',     Icon: Wifi },
    disconnected: { label: 'Offline',     color: 'text-muted-foreground', Icon: WifiOff },
    error:        { label: 'Error',       color: 'text-destructive', Icon: WifiOff },
  } as const;
  const { label, color, Icon } = map[status];
  return (
    <span className={`flex items-center gap-1 text-xs font-mono ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─── Markets page ─────────────────────────────────────────────────────────────

export default function Markets() {
  const [, navigate] = useLocation();
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('all');

  const queryParams = assetFilter !== 'all' ? { assetClass: assetFilter as 'forex' | 'crypto' } : {};
  const { data: symbols = [], isLoading: symbolsLoading, error: symbolsError } = useGetMarkets(queryParams);
  const { data: tfData, isLoading: tfLoading } = useGetTimeframes();

  // Live WebSocket prices — subscribe to every symbol in the current view.
  const symbolKeys = symbols.map((s) => s.symbol);
  const { ticks, status: wsStatus } = useMarketWebSocket(symbolKeys, symbolKeys.length > 0);

  const forexCount  = symbols.filter((s) => s.assetClass === 'forex').length;
  const cryptoCount = symbols.filter((s) => s.assetClass === 'crypto').length;
  const liveCount   = Object.keys(ticks).length;

  const filters: { key: AssetFilter; label: string }[] = [
    { key: 'all',    label: 'All' },
    { key: 'forex',  label: 'Forex' },
    { key: 'crypto', label: 'Crypto' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Stat cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Symbols"
          value={symbolsLoading ? '—' : symbols.length}
          icon={<Globe className="h-4 w-4" />}
          accent
        />
        <StatCard
          title="Forex Pairs"
          value={symbolsLoading ? '—' : forexCount}
          icon={<BarChart2 className="h-4 w-4" />}
        />
        <StatCard
          title="Crypto Pairs"
          value={symbolsLoading ? '—' : cryptoCount}
          icon={<Zap className="h-4 w-4" />}
        />
      </div>

      {/* ── Timeframes row ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Timeframes:</span>
        {tfLoading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6 w-10" />)
          : tfData?.timeframes?.map((tf) => (
              <Badge key={tf.value} variant="outline" className="font-mono text-xs">
                {tf.value}
              </Badge>
            ))}
      </div>

      {/* ── Asset class filter ── */}
      <div className="flex items-center gap-2">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setAssetFilter(key)}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded border transition-colors ${
              assetFilter === key
                ? 'bg-accent text-background border-accent'
                : 'bg-transparent text-muted-foreground border-border hover:border-accent/50 hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Symbol table ── */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              Symbol Catalogue
            </CardTitle>
            <div className="flex items-center gap-3">
              {liveCount > 0 && (
                <span className="text-xs font-mono text-muted-foreground">
                  {liveCount} live
                </span>
              )}
              <WsStatusBadge status={wsStatus} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {symbolsError ? (
            <div className="p-6 text-destructive text-sm font-mono">
              Failed to load symbols. Check API connection.
            </div>
          ) : symbolsLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : symbols.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">
              No symbols found.
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_120px_100px_120px_80px_32px] gap-4 px-6 py-2 border-b border-border bg-muted/30">
                {['Symbol', 'Display', 'Asset Class', 'Bid / Ask', 'Change', ''].map((h, i) => (
                  <span key={i} className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    {h}
                  </span>
                ))}
              </div>
              {/* Rows */}
              <div className="divide-y divide-border/50">
                {symbols.map((sym, idx) => {
                  const tick = ticks[sym.symbol];
                  const change = tick ? formatChange(tick.changePct24h) : null;
                  return (
                    <motion.div
                      key={sym.symbol}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.02 }}
                      onClick={() => navigate(`/markets/${sym.symbol}`)}
                      className="grid grid-cols-[1fr_120px_100px_120px_80px_32px] gap-4 px-6 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer group"
                    >
                      {/* Symbol */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${tick ? 'bg-accent animate-pulse' : sym.active ? 'bg-accent/40' : 'bg-muted'}`}
                        />
                        <span className="font-mono font-semibold tracking-wider text-sm group-hover:text-accent transition-colors">
                          {sym.symbol}
                        </span>
                      </div>

                      {/* Display name */}
                      <span className="font-mono text-sm text-muted-foreground">
                        {sym.displayName}
                      </span>

                      {/* Asset class badge */}
                      <Badge
                        variant="outline"
                        className={`font-mono text-xs w-fit ${
                          sym.assetClass === 'crypto'
                            ? 'border-accent/40 text-accent'
                            : 'border-muted-foreground/30 text-muted-foreground'
                        }`}
                      >
                        {sym.assetClass.toUpperCase()}
                      </Badge>

                      {/* Live bid / ask */}
                      <div className="flex flex-col justify-center">
                        {tick ? (
                          <span className="font-mono text-xs tabular-nums">
                            <span className="text-destructive/80">{formatPrice(tick.bid, sym.precision)}</span>
                            <span className="text-muted-foreground mx-1">/</span>
                            <span className="text-accent">{formatPrice(tick.ask, sym.precision)}</span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>

                      {/* 24h change */}
                      <div className="flex items-center">
                        {change ? (
                          <span className={`font-mono text-xs tabular-nums ${change.positive ? 'text-accent' : 'text-destructive'}`}>
                            {change.label}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-accent transition-colors self-center" />
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Live feed status bar ── */}
      <Card className="bg-card border-border border-dashed shadow-sm">
        <CardContent className="py-4 px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Activity className="h-4 w-4 shrink-0 text-accent/60" />
              <p className="text-sm font-mono">
                <span className="text-accent font-semibold">WebSocket feed active.</span>{' '}
                Streaming live bid/ask ticks for all symbols above.
                {wsStatus === 'connected' && liveCount > 0 && (
                  <span className="text-muted-foreground"> — {liveCount} symbols receiving data.</span>
                )}
              </p>
            </div>
            <WsStatusBadge status={wsStatus} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
