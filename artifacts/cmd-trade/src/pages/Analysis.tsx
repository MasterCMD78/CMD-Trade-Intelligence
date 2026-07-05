import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, Database, FileSearch, LineChart, Code2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Analysis() {
  const modules = [
    {
      id: 'data',
      name: 'Market Data Ingestion',
      description: 'High-frequency normalization of multi-exchange order books and trades.',
      icon: Database,
      status: 'Building',
    },
    {
      id: 'pattern',
      name: 'Pattern Detection',
      description: 'Real-time identification of technical structures and order flow anomalies.',
      icon: LineChart,
      status: 'Building',
    },
    {
      id: 'confidence',
      name: 'Confidence Engine',
      description: 'Probabilistic modeling to score setups based on historical precedents.',
      icon: FileSearch,
      status: 'Building',
    },
    {
      id: 'explain',
      name: 'Explainability Core',
      description: 'Translates model weights into human-readable rationale for trade execution.',
      icon: Code2,
      status: 'Building',
    }
  ];

  return (
    <div className="space-y-6">
      <div className="p-8 bg-muted/30 border border-border rounded-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10">
          <BrainCircuit className="h-64 w-64 -mt-10 -mr-10" />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight mb-2">AI Analysis Engine</h2>
          <p className="text-muted-foreground max-w-2xl text-lg">
            The quantitative modeling core is currently under active development. 
            Once deployed, this subsystem will provide deep-learning powered market insights.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((module, i) => (
          <motion.div
            key={module.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <Card className="bg-card border-border shadow-sm h-full group hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md group-hover:bg-primary/10 transition-colors">
                    <module.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle className="text-base font-semibold">{module.name}</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px] uppercase bg-muted/50 text-muted-foreground">
                  {module.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mt-2">{module.description}</p>
                
                <div className="mt-6 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="font-mono text-xs text-muted-foreground">Compiling module weights...</span>
                  </div>
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/40 w-1/3 animate-[pulse_2s_ease-in-out_infinite]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
