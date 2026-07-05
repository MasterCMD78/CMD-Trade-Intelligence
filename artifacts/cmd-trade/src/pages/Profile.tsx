import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGetMe, useUpdateMe } from '@workspace/api-client-react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { User as UserIcon, Save } from 'lucide-react';
import { motion } from 'framer-motion';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  avatarUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { user: authUser } = useAuth();
  const { data: user, isLoading, error } = useGetMe();
  const updateMeMutation = useUpdateMe();
  const { toast } = useToast();
  
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: '',
      avatarUrl: '',
    },
  });

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (user && initializedForId.current !== user.id) {
      initializedForId.current = user.id;
      form.reset({
        fullName: user.fullName,
        avatarUrl: user.avatarUrl || '',
      });
    }
  }, [user, form]);

  const onSubmit = (values: ProfileFormValues) => {
    updateMeMutation.mutate(
      { data: { fullName: values.fullName, avatarUrl: values.avatarUrl || null } },
      {
        onSuccess: () => {
          toast({
            title: 'Profile Updated',
            description: 'Your trader profile has been successfully updated.',
          });
        },
        onError: () => {
          toast({
            title: 'Update Failed',
            description: 'There was a problem updating your profile.',
            variant: 'destructive',
          });
        }
      }
    );
  };

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
        <h3 className="font-bold mb-2 text-lg">Error loading profile</h3>
        <p>There was a problem retrieving your user profile.</p>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Trader Profile</h2>
          <p className="text-muted-foreground">Manage your identity and operational parameters.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Identity Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="md:col-span-1 space-y-6"
        >
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                {isLoading ? (
                  <Skeleton className="h-24 w-24 rounded-full" />
                ) : (
                  <Avatar className="h-24 w-24 border-2 border-border shadow-md">
                    <AvatarImage src={user?.avatarUrl || ''} />
                    <AvatarFallback className="bg-muted text-muted-foreground font-mono text-xl">
                      {user?.fullName ? getInitials(user.fullName) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
              <CardTitle className="text-xl font-bold">
                {isLoading ? <Skeleton className="h-6 w-32 mx-auto" /> : user?.fullName}
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                {isLoading ? <Skeleton className="h-4 w-40 mx-auto mt-2" /> : user?.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 border-t border-border/50">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-mono uppercase tracking-wider text-xs">Access Level</span>
                {isLoading ? <Skeleton className="h-5 w-16" /> : (
                  <Badge variant="outline" className="font-mono uppercase text-[10px] bg-primary/10 text-primary border-primary/30">
                    {user?.role}
                  </Badge>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-mono uppercase tracking-wider text-xs">Current Plan</span>
                {isLoading ? <Skeleton className="h-5 w-16" /> : (
                  <Badge variant="outline" className="font-mono uppercase text-[10px]">
                    {user?.plan}
                  </Badge>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-mono uppercase tracking-wider text-xs">Joined</span>
                {isLoading ? <Skeleton className="h-5 w-24" /> : (
                  <span className="font-mono text-muted-foreground">
                    {user?.createdAt ? format(new Date(user.createdAt), 'yyyy-MM-dd') : '—'}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Edit Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="md:col-span-2"
        >
          <Card className="bg-card border-border shadow-sm h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserIcon className="h-5 w-5 text-primary" />
                Identity Configuration
              </CardTitle>
              <CardDescription>
                Update your display name and avatar URL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-6">
                  <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
                  <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
                  <Skeleton className="h-10 w-32" />
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Operator Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Full Name" 
                              className="bg-background font-mono text-sm border-border focus-visible:ring-primary"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="avatarUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Avatar Image URL (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="https://example.com/avatar.jpg" 
                              className="bg-background font-mono text-sm border-border focus-visible:ring-primary"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium tracking-wide"
                      disabled={updateMeMutation.isPending || !form.formState.isDirty}
                    >
                      {updateMeMutation.isPending ? (
                        "COMMITTING..."
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          COMMIT CHANGES
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
