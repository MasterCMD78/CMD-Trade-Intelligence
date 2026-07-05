import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGetUserSettings, useUpdateUserSettings } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Settings2, Save, Monitor, Bell, Clock, CircleDollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

const settingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  notifications: z.boolean(),
  defaultCurrency: z.string().min(1, 'Required'),
  defaultTimeframe: z.string().min(1, 'Required'),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { data: settings, isLoading, error } = useGetUserSettings();
  const updateSettingsMutation = useUpdateUserSettings();
  const { toast } = useToast();
  
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      theme: 'dark',
      notifications: true,
      defaultCurrency: 'USD',
      defaultTimeframe: '1H',
    },
  });

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (settings && initializedForId.current !== settings.userId) {
      initializedForId.current = settings.userId;
      form.reset({
        theme: settings.theme,
        notifications: settings.notifications,
        defaultCurrency: settings.defaultCurrency,
        defaultTimeframe: settings.defaultTimeframe,
      });
    }
  }, [settings, form]);

  const onSubmit = (values: SettingsFormValues) => {
    updateSettingsMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({
            title: 'Settings Saved',
            description: 'Your terminal preferences have been updated.',
          });
        },
        onError: () => {
          toast({
            title: 'Save Failed',
            description: 'There was a problem saving your preferences.',
            variant: 'destructive',
          });
        }
      }
    );
  };

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
        <h3 className="font-bold mb-2 text-lg">Error loading settings</h3>
        <p>There was a problem retrieving your configuration.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Terminal Settings</h2>
          <p className="text-muted-foreground">Configure your environment preferences and defaults.</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings2 className="h-5 w-5 text-primary" />
              Environment Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-8">
                <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full max-w-md" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full max-w-md" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full max-w-md" /></div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  
                  <div className="grid gap-8 md:grid-cols-2">
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="theme"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-xs uppercase tracking-wider font-mono text-muted-foreground">
                              <Monitor className="h-3.5 w-3.5" /> Color Theme
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background border-border font-mono text-sm">
                                  <SelectValue placeholder="Select theme" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="dark">Dark (Terminal Default)</SelectItem>
                                <SelectItem value="light">Light</SelectItem>
                                <SelectItem value="system">System Synchronized</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription className="text-xs text-muted-foreground/70">
                              App is forced to dark mode by default.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border bg-background p-4 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel className="flex items-center gap-2 text-sm font-medium">
                                <Bell className="h-4 w-4 text-muted-foreground" /> Alert System
                              </FormLabel>
                              <FormDescription className="text-xs">
                                Receive signal and risk alerts.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="data-[state=checked]:bg-primary"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="defaultCurrency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-xs uppercase tracking-wider font-mono text-muted-foreground">
                              <CircleDollarSign className="h-3.5 w-3.5" /> Base Currency
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background border-border font-mono text-sm">
                                  <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="USD">USD - US Dollar</SelectItem>
                                <SelectItem value="EUR">EUR - Euro</SelectItem>
                                <SelectItem value="GBP">GBP - British Pound</SelectItem>
                                <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="defaultTimeframe"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-xs uppercase tracking-wider font-mono text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" /> Default Timeframe
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background border-border font-mono text-sm">
                                  <SelectValue placeholder="Select timeframe" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1M">1 Minute</SelectItem>
                                <SelectItem value="5M">5 Minutes</SelectItem>
                                <SelectItem value="15M">15 Minutes</SelectItem>
                                <SelectItem value="1H">1 Hour</SelectItem>
                                <SelectItem value="4H">4 Hours</SelectItem>
                                <SelectItem value="1D">Daily</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50 flex justify-end">
                    <Button 
                      type="submit" 
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium tracking-wide"
                      disabled={updateSettingsMutation.isPending || !form.formState.isDirty}
                    >
                      {updateSettingsMutation.isPending ? (
                        "WRITING..."
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          WRITE CONFIGURATION
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
