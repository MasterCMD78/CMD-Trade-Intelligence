import React, { useState } from 'react';
import { useGetAdminStats, useGetAdminUsers } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Activity, Zap, Crown, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function Admin() {
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const { data: stats, isLoading: isStatsLoading, error: statsError } = useGetAdminStats();
  const { data: usersData, isLoading: isUsersLoading, error: usersError } = useGetAdminUsers({ page, limit });

  if (statsError || usersError) {
    return (
      <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
        <h3 className="font-bold mb-2 text-lg">Error loading admin data</h3>
        <p>You may not have authorization to view this page or the server encountered an error.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Crown className="h-6 w-6" />
            Admin Overview
          </h2>
          <p className="text-muted-foreground">System-wide metrics and user management.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold font-mono tracking-tight">{stats?.totalUsers}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Active Users</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold font-mono tracking-tight text-primary">{stats?.activeUsers}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Total Signals</CardTitle>
              <Zap className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold font-mono tracking-tight">{stats?.totalSignals}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Enterprise</CardTitle>
              <Crown className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold font-mono tracking-tight text-amber-500">
                  {stats?.planBreakdown?.enterprise || 0}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Platform Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isUsersLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !usersData?.users || usersData.users.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No users found.</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">ID</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Name</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Email</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Role</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Plan</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData.users.map((u) => (
                    <TableRow key={u.id} className="border-border/50 hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">{u.id}</TableCell>
                      <TableCell className="font-medium">{u.fullName}</TableCell>
                      <TableCell className="font-mono text-sm">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase ${u.role === 'admin' ? 'border-primary text-primary bg-primary/10' : ''}`}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase ${u.plan === 'enterprise' ? 'border-amber-500 text-amber-500 bg-amber-500/10' : ''}`}>
                          {u.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {format(new Date(u.createdAt), 'dd MMM yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-4 border-t border-border/50 flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, usersData.total)} of {usersData.total}
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * limit >= usersData.total}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
