import React from 'react';
import { useGetDashboardSummary } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Radio, ShieldAlert, Zap, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { data: summary, isLoading, error } = useGetDashboardSummary();

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
        <h3 className="font-bold mb-2 text-lg">Error loading dashboard</h3>
        <p>There was a problem retrieving the dashboard summary data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          title="Total Signals" 
          value={summary?.totalSignals} 
          icon={Zap} 
          isLoading={isLoading} 
          delay={0.1}
        />
        <MetricCard 
          title="Active Markets" 
          value={summary?.activeMarkets} 
          icon={Activity} 
          isLoading={isLoading} 
          delay={0.2}
        />
        <MetricCard 
          title="Account Status" 
          value={summary?.accountStatus} 
          icon={ShieldAlert} 
          isLoading={isLoading} 
          valueClass={summary?.accountStatus === 'ACTIVE' ? 'text-primary' : ''}
          delay={0.3}
        />
        <MetricCard 
          title="Market Status" 
          value={summary?.marketStatus} 
          icon={Radio} 
          isLoading={isLoading} 
          valueClass={summary?.marketStatus === 'OPEN' ? 'text-buy' : 'text-muted-foreground'}
          delay={0.4}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-1 lg:col-span-4 bg-card border-border shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-sm uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Recent Signals
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[350px] flex items-center justify-center flex-col text-muted-foreground gap-3">
              <Zap className="h-8 w-8 opacity-20" />
              <p className="font-mono text-sm uppercase tracking-widest opacity-50">Awaiting Signal Feed</p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-3 bg-card border-border shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-sm uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Market Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[350px] flex items-center justify-center flex-col text-muted-foreground gap-3">
              <Activity className="h-8 w-8 opacity-20" />
              <p className="font-mono text-sm uppercase tracking-widest opacity-50">Market Matrix Offline</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, isLoading, valueClass, delay }: { 
  title: string, 
  value: any, 
  icon: any, 
  isLoading: boolean, 
  valueClass?: string,
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="bg-card border-border shadow-sm overflow-hidden relative group hover:border-primary/50 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
            {title}
          </CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className={`text-2xl font-bold font-mono tracking-tight ${valueClass || 'text-foreground'}`}>
              {value !== undefined ? value : '—'}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
