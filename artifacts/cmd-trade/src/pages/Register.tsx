import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, Link } from 'wouter';
import { useRegister, useLogin } from '@workspace/api-client-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const registerMutation = useRegister();
  const loginMutation = useLogin();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const onSubmit = (values: RegisterFormValues) => {
    registerMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          login(data);
          setLocation('/dashboard');
        },
        onError: (err) => {
          const msg = (err.data as { error?: string } | null)?.error;
          form.setError('root', { 
            message: msg || 'Registration failed. Please try again.' 
          });
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row-reverse">
      {/* Branding Panel */}
      <div className="hidden lg:flex flex-1 bg-muted/20 border-l border-border items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-accent/10 via-background to-background"></div>
        <div className="relative z-10 p-12 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-accent/10 rounded-xl">
              <Zap className="h-8 w-8 text-accent fill-accent glow-accent" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">CMD TRADE</h1>
          </div>
          <h2 className="text-4xl font-medium tracking-tight mb-4 leading-tight">
            Elevate your edge.
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join thousands of traders using CMD to spot opportunities earlier, manage risk tighter, and execute with precision.
          </p>
          <div className="grid grid-cols-2 gap-4 font-mono text-sm">
            <div className="p-4 bg-card border border-border rounded-lg">
              <div className="text-muted-foreground mb-1 text-xs">MARKETS</div>
              <div className="text-xl text-foreground">1,204</div>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <div className="text-muted-foreground mb-1 text-xs">UPTIME</div>
              <div className="text-xl text-primary">99.99%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Register Form */}
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
            <h2 className="text-3xl font-semibold tracking-tight">Request Access</h2>
            <p className="text-muted-foreground">Create your trader profile to enter the platform.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Full Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="John Doe" 
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
                        autoComplete="new-password"
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
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "PROVISIONING..." : "CREATE TERMINAL ACCOUNT"}
              </Button>
            </form>
          </Form>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Initialize Session
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
