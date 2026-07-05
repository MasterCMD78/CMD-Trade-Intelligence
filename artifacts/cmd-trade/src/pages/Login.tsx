import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, Link } from 'wouter';
import { useLogin } from '@workspace/api-client-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          login(data);
          setLocation('/dashboard');
        },
        onError: () => {
          form.setError('root', { message: 'Invalid credentials. Please try again.' });
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Branding Panel */}
      <div className="hidden lg:flex flex-1 bg-muted/20 border-r border-border items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay"></div>
        <div className="relative z-10 p-12 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Zap className="h-8 w-8 text-primary fill-primary glow-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">CMD TRADE</h1>
          </div>
          <h2 className="text-4xl font-medium tracking-tight mb-4 leading-tight">
            Institutional intelligence for retail precision.
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Advanced market data, signal detection, and risk management algorithms unified in a single, high-performance terminal.
          </p>
          <div className="space-y-4 font-mono text-sm text-muted-foreground/80">
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span>SYSTEM.STATUS</span>
              <span className="text-primary">ONLINE</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span>MARKET.DATA.FEED</span>
              <span className="text-primary">CONNECTED</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span>LATENCY</span>
              <span className="text-primary">12ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Zap className="h-6 w-6 text-primary fill-primary" />
            <h1 className="text-2xl font-bold tracking-tight">CMD TRADE</h1>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight">Terminal Access</h2>
            <p className="text-muted-foreground">Enter your credentials to connect to the platform.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Email Address</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="trader@example.com" 
                        type="email" 
                        autoComplete="email"
                        className="bg-card font-mono text-sm border-border focus-visible:ring-primary h-11"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Password</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="••••••••" 
                        type="password" 
                        autoComplete="current-password"
                        className="bg-card font-mono text-sm border-border focus-visible:ring-primary h-11"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
                  {form.formState.errors.root.message}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-11 font-medium tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 hover:glow-primary transition-all"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "CONNECTING..." : "INITIALIZE SESSION"}
              </Button>
            </form>
          </Form>

          <div className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Request Access
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
