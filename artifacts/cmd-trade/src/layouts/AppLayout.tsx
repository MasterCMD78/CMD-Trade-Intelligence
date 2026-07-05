import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  TrendingUp, 
  BrainCircuit, 
  Zap, 
  ShieldAlert, 
  User, 
  Settings, 
  Crown,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Markets', path: '/markets', icon: TrendingUp },
    { name: 'Analysis', path: '/analysis', icon: BrainCircuit },
    { name: 'Signals', path: '/signals', icon: Zap },
    { name: 'Risk Management', path: '/risk', icon: ShieldAlert },
    { name: 'Profile', path: '/profile', icon: User },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  if (user?.role === 'admin') {
    navItems.push({ name: 'Admin', path: '/admin', icon: Crown });
  }

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const pageTitle = navItems.find((item) => item.path === location)?.name || 'CMD Trade';

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 256 }}
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-sidebar shrink-0 z-20",
          collapsed ? "items-center" : "items-stretch"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
          {!collapsed && (
            <span className="font-bold tracking-tight text-primary flex items-center gap-2">
              <Zap className="h-5 w-5 fill-primary" />
              <span>CMD TRADE</span>
            </span>
          )}
          {collapsed && <Zap className="h-6 w-6 text-primary fill-primary mx-auto" />}
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors group relative",
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "")} />
                  {!collapsed && <span>{item.name}</span>}
                  
                  {collapsed && (
                    <div className="absolute left-full ml-4 px-2 py-1 bg-popover border border-border text-popover-foreground text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-border shrink-0 space-y-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full h-8 flex justify-center text-muted-foreground hover:text-foreground"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <div
            className={cn(
              "flex items-center gap-3 cursor-pointer text-muted-foreground hover:text-destructive transition-colors px-3 py-2 rounded-md hover:bg-destructive/10",
              collapsed ? "justify-center" : ""
            )}
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-muted-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold tracking-tight">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="outline" className="hidden sm:flex border-primary/30 text-primary bg-primary/5 uppercase tracking-wider font-mono text-[10px]">
              {user?.plan || 'Free'} Plan
            </Badge>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium leading-none">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Avatar className="h-9 w-9 border border-border">
                <AvatarImage src={user?.avatarUrl || ''} />
                <AvatarFallback className="bg-muted text-muted-foreground font-mono text-xs">
                  {user?.fullName ? getInitials(user.fullName) : 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Mobile menu overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                className="fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-border z-50 flex flex-col md:hidden"
              >
                <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
                  <span className="font-bold tracking-tight text-primary flex items-center gap-2">
                    <Zap className="h-5 w-5 fill-primary" />
                    <span>CMD TRADE</span>
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                  {navItems.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <div
                          className={cn(
                            "flex items-center gap-3 px-3 py-3 rounded-md cursor-pointer transition-colors",
                            isActive 
                              ? "bg-primary/10 text-primary font-medium" 
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <div className="p-4 border-t border-border shrink-0">
                  <div
                    className="flex items-center gap-3 cursor-pointer text-muted-foreground hover:text-destructive transition-colors px-3 py-2 rounded-md hover:bg-destructive/10"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="h-5 w-5 shrink-0" />
                    <span>Logout</span>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background relative">
          <div className="max-w-7xl mx-auto w-full pb-20">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
