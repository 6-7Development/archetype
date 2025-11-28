import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerUserSchema, loginUserSchema, type RegisterUser, type LoginUser } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Github, Chrome, Building2, Hexagon } from "lucide-react";
import { HexadIcon } from '@/components/beehive-logos';

export default function WorkingAuth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginForm = useForm<LoginUser>({
    resolver: zodResolver(loginUserSchema),
    mode: "onSubmit",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterUser>({
    resolver: zodResolver(registerUserSchema),
    mode: "onSubmit",
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginUser) => {
      return await apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      // Check if user is owner/root and redirect to healing chat
      const meData = await queryClient.fetchQuery({ queryKey: ["/api/auth/me"] }) as any;
      const isOwner = meData?.user?.isOwner;
      const userName = meData?.user?.name || meData?.user?.firstName || "there";
      
      if (isOwner) {
        toast({
          title: `Welcome back, ${userName}!`,
          description: "Redirecting to Platform Healing...",
        });
        setTimeout(() => setLocation("/platform-healing"), 500);
      } else {
        toast({
          title: `Welcome back, ${userName}!`,
          description: "Redirecting to your dashboard...",
        });
        setTimeout(() => setLocation("/dashboard"), 500);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterUser) => {
      return await apiRequest("POST", "/api/auth/register", data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      // Check if user is owner/root and redirect to healing chat
      const meData = await queryClient.fetchQuery({ queryKey: ["/api/auth/me"] }) as any;
      const isOwner = meData?.user?.isOwner;
      const userName = meData?.user?.name || meData?.user?.firstName || "there";
      
      if (isOwner) {
        toast({
          title: `Account created, ${userName}!`,
          description: "Welcome to Hexad. Redirecting to Platform Healing...",
        });
        setTimeout(() => setLocation("/platform-healing"), 500);
      } else {
        toast({
          title: `Account created, ${userName}!`,
          description: "Welcome to Hexad. Redirecting...",
        });
        setTimeout(() => setLocation("/dashboard"), 500);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Email already registered",
        variant: "destructive",
      });
    },
  });

  const onLoginSubmit = (data: LoginUser) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterUser) => {
    registerMutation.mutate(data);
  };

  const handleReplitLogin = () => {
    // Redirect to Replit OAuth login
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-background">
      {/* Honeycomb Pattern Background - Matches Landing Page */}
      <div className="fixed inset-0 opacity-5 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23F7B500' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Warm Honey/Mint Glow - Matches Brand */}
      <div 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-15 blur-3xl pointer-events-none"
        style={{ 
          zIndex: 0,
          background: 'radial-gradient(circle, rgba(247, 181, 0, 0.3), rgba(0, 212, 179, 0.2), transparent 70%)'
        }}
      />

      {/* Interactive Form Layer */}
      <div className="w-full max-w-md relative" style={{ zIndex: 10 }}>
        <Card className="border-2 backdrop-blur-sm bg-card/95 shadow-2xl">
          <CardHeader className="space-y-4 text-center pb-6">
            {/* Tech-Enhanced Bee Logo */}
            <div className="flex justify-center">
              <HexadIcon size={72} />
            </div>

            <div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-honey via-nectar to-mint bg-clip-text text-transparent mb-2">
                {mode === "login" ? "Welcome Back" : "Get Started"}
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                {mode === "login" 
                  ? "Sign in to continue building amazing projects" 
                  : "Create your account and start building with AI"}
              </CardDescription>
            </div>

            {/* Professional Badge - Honey/Mint Theme */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
              <Hexagon className="w-3.5 h-3.5 text-honey fill-honey/20" />
              <span className="font-medium">AI-Powered Development Platform</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-6 pb-6">
            {/* Replit OAuth - Primary Authentication Method */}
            <div className="space-y-2.5">
              <Button 
                variant="default" 
                className="w-full h-11 bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold" 
                onClick={handleReplitLogin}
                data-testid="button-replit-login"
                type="button"
              >
                <Hexagon className="w-4 h-4 mr-2 fill-charcoal-950" />
                Continue with Replit
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Sign in with Google, GitHub, X, or Apple
              </p>
            </div>

            {/* Separator */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center pointer-events-none">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground font-medium">Testing Credentials (Root Only)</span>
              </div>
            </div>

            {/* Email/Password Form */}
            {mode === "login" ? (
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-foreground">Email Address</Label>
                  <Input 
                    id="login-email"
                    type="email" 
                    placeholder="you@example.com" 
                    data-testid="input-login-email"
                    autoComplete="email"
                    className="h-11 bg-card border-border text-foreground placeholder:text-muted-foreground"
                    {...loginForm.register("email")}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm font-medium text-red-400">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-foreground">Password</Label>
                  <Input 
                    id="login-password"
                    type="password" 
                    placeholder="••••••••" 
                    data-testid="input-login-password"
                    autoComplete="current-password"
                    className="h-11 bg-card border-border text-foreground placeholder:text-muted-foreground"
                    {...loginForm.register("password")}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm font-medium text-red-400">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold" 
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="register-firstname" className="text-foreground">First Name</Label>
                    <Input 
                      id="register-firstname"
                      placeholder="John" 
                      data-testid="input-register-firstname"
                      autoComplete="given-name"
                      className="h-11 bg-card border-border text-foreground placeholder:text-muted-foreground"
                      {...registerForm.register("firstName")}
                    />
                    {registerForm.formState.errors.firstName && (
                      <p className="text-sm font-medium text-red-400">
                        {registerForm.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-lastname" className="text-foreground">Last Name</Label>
                    <Input 
                      id="register-lastname"
                      placeholder="Doe" 
                      data-testid="input-register-lastname"
                      autoComplete="family-name"
                      className="h-11 bg-card border-border text-foreground placeholder:text-muted-foreground"
                      {...registerForm.register("lastName")}
                    />
                    {registerForm.formState.errors.lastName && (
                      <p className="text-sm font-medium text-red-400">
                        {registerForm.formState.errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-foreground">Email Address</Label>
                  <Input 
                    id="register-email"
                    type="email" 
                    placeholder="you@example.com" 
                    data-testid="input-register-email"
                    autoComplete="email"
                    className="h-11 bg-card border-border text-foreground placeholder:text-muted-foreground"
                    {...registerForm.register("email")}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-sm font-medium text-red-400">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-foreground">Password</Label>
                  <Input 
                    id="register-password"
                    type="password" 
                    placeholder="••••••••" 
                    data-testid="input-register-password"
                    autoComplete="new-password"
                    className="h-11 bg-card border-border text-foreground placeholder:text-muted-foreground"
                    {...registerForm.register("password")}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-sm font-medium text-red-400">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold" 
                  disabled={registerMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            )}

            {/* Toggle Mode */}
            <div className="text-center text-sm pt-2">
              <span className="text-muted-foreground">
                {mode === "login" ? "Don't have an account?" : "Already have an account?"}
              </span>
              {" "}
              <button
                type="button"
                className="font-semibold text-honey hover:text-honey/80 hover:underline focus:outline-none focus:underline"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  loginForm.reset();
                  registerForm.reset();
                }}
                data-testid="button-toggle-mode"
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </div>

            {/* Trust Badge - Matches Landing */}
            <div className="pt-4 border-t border-honey/10">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-honey" />
                <span>Gemini 2.5 Flash + Claude Sonnet 4</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Links */}
        <div className="mt-6 text-center text-sm">
          <a 
            href="/" 
            className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 hover:underline font-medium"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
