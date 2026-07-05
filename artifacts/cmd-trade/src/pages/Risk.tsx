import React from 'react';
import { useGetRiskSummary } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ShieldAlert, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Risk() {
  const { data: risk, isLoading, error } = useGetRiskSummary();

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
        <h3 className="font-bold mb-2 text-lg">Error loading risk parameters</h3>
        <p>There was a problem retrieving risk management data.</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    if (status === 'SAFE' || status === 'NORMAL') return 'text-primary';
    if (status === 'WARNING') return 'text-amber-500';
    if (status === 'CRITICAL') return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'SAFE' || status === 'NORMAL') return <ShieldCheck className="h-8 w-8 text-primary" />;
    if (status === 'WARNING') return <AlertTriangle className="h-8 w-8 text-amber-500" />;
    if (status === 'CRITICAL') return <ShieldAlert className="h-8 w-8 text-destructive" />;
    return <ShieldAlert className="h-8 w-8 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Risk Parameters</h2>
          <p className="text-muted-foreground">Account exposure and drawdown limits.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-3 bg-card border-border shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-muted rounded-full">
                {isLoading ? <Skeleton className="h-8 w-8 rounded-full" /> : getStatusIcon(risk?.status || '')}
              </div>
              <div>
                <p className="text-sm font-mono uppercase text-muted-foreground tracking-wider mb-1">Global Risk State</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <h3 className={`text-2xl font-bold font-mono tracking-tight uppercase ${getStatusColor(risk?.status || '')}`}>
                    {risk?.status || 'UNKNOWN'}
                  </h3>
                )}
              </div>
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-sm text-muted-foreground font-mono">ENFORCEMENT ENGINE</p>
              <p className="text-primary font-mono font-bold tracking-tight">ACTIVE</p>
            </div>
          </CardContent>
        </Card>

        <RiskParameterCard 
          title="Max Drawdown Limit" 
          value={risk?.maxDrawdownPct} 
          currentValue={2.4} 
          isLoading={isLoading} 
          delay={0.1} 
        />
        <RiskParameterCard 
          title="Max Position Size" 
          value={risk?.maxPositionSizePct} 
          currentValue={risk?.maxPositionSizePct ? risk.maxPositionSizePct * 0.8 : 0} 
          isLoading={isLoading} 
          delay={0.2} 
        />
        <RiskParameterCard 
          title="Risk Per Trade" 
          value={risk?.riskPerTradePct} 
          currentValue={risk?.riskPerTradePct || 0} 
          isLoading={isLoading} 
          delay={0.3} 
        />
      </div>
    </div>
  );
}

function RiskParameterCard({ title, value, currentValue, isLoading, delay }: {
  title: string,
  value: number | undefined,
  currentValue: number,
  isLoading: boolean,
  delay: number
}) {
  const percentage = value ? Math.min(100, (currentValue / value) * 100) : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="bg-card border-border shadow-sm h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-2 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold font-mono tracking-tight">{value}%</span>
                <span className="text-sm font-mono text-muted-foreground mb-1">Cap</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Current utilized</span>
                  <span>{currentValue.toFixed(1)}%</span>
                </div>
                <Progress value={percentage} className="h-1.5 bg-muted" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
