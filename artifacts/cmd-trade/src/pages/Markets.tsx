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
  Globe, BarChart2, Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number, precision: number): string {
  return n.toFixed(precision);
}

function formatChange(pct: number): { label: string; positive: boolean } {
  const sign = pct >= 0 ? '+' : '';
  return { label: `${sign}${pct.toFixed(2)}%`, positive: pct >= 0 };
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

// ─── Markets page ─────────────────────────────────────────────────────────────

export default function Markets() {
  const [, navigate] = useLocation();
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('all');

  const queryParams = assetFilter !== 'all' ? { assetClass: assetFilter as 'forex' | 'crypto' } : {};
  const { data: symbols = [], isLoading: symbolsLoading, error: symbolsError } = useGetMarkets(queryParams);
  const { data: tfData, isLoading: tfLoading } = useGetTimeframes();

  const forexCount  = symbols.filter((s) => s.assetClass === 'forex').length;
  const cryptoCount = symbols.filter((s) => s.assetClass === 'crypto').length;

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
          <CardTitle className="text-sm uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            Symbol Catalogue
          </CardTitle>
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
              <div className="grid grid-cols-[1fr_120px_100px_80px_32px] gap-4 px-6 py-2 border-b border-border bg-muted/30">
                {['Symbol', 'Display', 'Asset Class', 'Hours', ''].map((h, i) => (
                  <span key={i} className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    {h}
                  </span>
                ))}
              </div>
              {/* Rows */}
              <div className="divide-y divide-border/50">
                {symbols.map((sym, idx) => (
                  <motion.div
                    key={sym.symbol}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.02 }}
                    onClick={() => navigate(`/markets/${sym.symbol}`)}
                    className="grid grid-cols-[1fr_120px_100px_80px_32px] gap-4 px-6 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer group"
                  >
                    {/* Symbol */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${sym.active ? 'bg-accent' : 'bg-muted'}`}
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

                    {/* Trading hours */}
                    <span className="font-mono text-xs text-muted-foreground">
                      {sym.tradingHours}
                    </span>

                    {/* Arrow */}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-accent transition-colors self-center" />
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── WebSocket notice ── */}
      <Card className="bg-card border-border border-dashed shadow-sm">
        <CardContent className="py-5 px-6">
          <div className="flex items-center gap-4 text-muted-foreground">
            <Activity className="h-5 w-5 shrink-0 text-accent/60" />
            <div>
              <p className="text-sm font-mono">
                <span className="text-accent font-semibold">Live feed ready.</span>{' '}
                Connect via WebSocket at <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/ws</code> to stream
                real-time ticks and candles for any symbol.
                Subscribe with{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  {JSON.stringify({ type: 'subscribe', channel: 'tick:EURUSD' })}
                </code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
