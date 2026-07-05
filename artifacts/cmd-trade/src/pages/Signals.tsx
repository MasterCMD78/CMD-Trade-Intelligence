import React from 'react';
import { useGetSignals } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Zap, ArrowUpRight, ArrowDownRight, Minus, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function Signals() {
  const { data: signals, isLoading, error } = useGetSignals();

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
        <h3 className="font-bold mb-2 text-lg">Error loading signals</h3>
        <p>There was a problem retrieving the signal feed.</p>
      </div>
    );
  }

  const getDirectionIcon = (dir: string) => {
    switch (dir) {
      case 'buy': return <ArrowUpRight className="h-4 w-4 mr-1 text-buy" />;
      case 'sell': return <ArrowDownRight className="h-4 w-4 mr-1 text-sell" />;
      default: return <Minus className="h-4 w-4 mr-1 text-muted-foreground" />;
    }
  };

  const getDirectionClass = (dir: string) => {
    switch (dir) {
      case 'buy': return 'text-buy';
      case 'sell': return 'text-sell';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': 
        return <Badge className="bg-primary/20 text-primary border-primary/30 font-mono text-[10px] uppercase">ACTIVE</Badge>;
      case 'pending': 
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 font-mono text-[10px] uppercase">PENDING</Badge>;
      case 'closed': 
        return <Badge variant="outline" className="font-mono text-[10px] uppercase text-muted-foreground">CLOSED</Badge>;
      default:
        return <Badge variant="outline" className="font-mono text-[10px] uppercase">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Signal Matrix</h2>
          <p className="text-muted-foreground">Algorithmic trading setups and execution points.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          SYSTEM LIVE
        </div>
      </div>

      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !signals || signals.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-4">
              <AlertCircle className="h-12 w-12 opacity-20" />
              <div className="text-center">
                <h3 className="font-medium text-foreground">No active signals</h3>
                <p className="text-sm mt-1">The matrix is currently empty. Awaiting new setup formations.</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Asset</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Direction</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Status</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">TF</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((signal, idx) => (
                  <TableRow 
                    key={signal.id} 
                    className="border-border/50 hover:bg-muted/50 transition-colors group cursor-pointer"
                  >
                    <TableCell className="font-mono font-medium flex items-center gap-2">
                      {signal.symbol}
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center font-mono font-bold uppercase text-sm ${getDirectionClass(signal.direction)}`}>
                        {getDirectionIcon(signal.direction)}
                        {signal.direction}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(signal.status)}</TableCell>
                    <TableCell className="font-mono text-sm">{signal.timeframe}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {format(new Date(signal.createdAt), 'dd MMM HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
