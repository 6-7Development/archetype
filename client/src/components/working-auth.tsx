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
import { Loader2, Sparkles, Github, Chrome, Building2 } from "lucide-react";
import logoPath from "@assets/logo.svg";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Welcome back!",
        description: "Redirecting to your dashboard...",
      });
      setTimeout(() => setLocation("/dashboard"), 500);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Account created!",
        description: "Welcome to LemonAid. Redirecting...",
      });
      setTimeout(() => setLocation("/dashboard"), 500);
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

  const handleSocialLogin = (provider: string) => {
    toast({
      title: "Coming Soon",
      description: `${provider} authentication will be available soon.`,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative dark">
      {/* Brand Layer - Decorative Background (no pointer events) */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pointer-events-none" style={{ zIndex: 0 }} />
      
      {/* Subtle Grid Pattern */}
      <div 
        className="fixed inset-0 opacity-[0.02] pointer-events-none" 
        style={{ 
          zIndex: 0,
          backgroundImage: 'radial-gradient(circle, rgba(148, 163, 184, 0.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} 
      />

      {/* Brand Glow */}
      <div 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20 blur-3xl pointer-events-none"
        style={{ 
          zIndex: 0,
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4), rgba(139, 92, 246, 0.3), transparent 70%)'
        }}
      />

      {/* Interactive Form Layer */}
      <div className="w-full max-w-md relative" style={{ zIndex: 10 }}>
        <Card className="border-2 backdrop-blur-sm bg-card/95 shadow-2xl">
          <CardHeader className="space-y-4 text-center pb-6">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary opacity-20 blur-xl rounded-xl pointer-events-none" />
                <img 
                  src={logoPath} 
                  alt="LemonAid" 
                  className="w-20 h-20 rounded-xl shadow-xl relative"
                />
              </div>
            </div>

            <div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-2">
                {mode === "login" ? "Welcome Back" : "Get Started"}
              </CardTitle>
              <CardDescription className="text-base">
                {mode === "login" 
                  ? "Sign in to continue building amazing projects" 
                  : "Create your account and start building with AI"}
              </CardDescription>
            </div>

            {/* Professional Badge */}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
              <Building2 className="w-3.5 h-3.5" />
              <span className="font-medium">Enterprise-Grade Development Platform</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-6 pb-6">
            {/* Social Login Buttons */}
            <div className="space-y-2.5">
              <Button 
                variant="outline" 
                className="w-full h-11 text-white border-slate-600 hover:bg-slate-700" 
                onClick={() => handleSocialLogin("Google")}
                data-testid="button-google-login"
                type="button"
              >
                <Chrome className="w-4 h-4 mr-2" />
                Continue with Google
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-11 text-white border-slate-600 hover:bg-slate-700"
                onClick={() => handleSocialLogin("GitHub")}
                data-testid="button-github-login"
                type="button"
              >
                <Github className="w-4 h-4 mr-2" />
                Continue with GitHub
              </Button>
            </div>

            {/* Separator */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center pointer-events-none">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800 px-3 text-slate-400 font-medium">Or continue with email</span>
              </div>
            </div>

            {/* Email/Password Form */}
            {mode === "login" ? (
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-slate-200">Email Address</Label>
                  <Input 
                    id="login-email"
                    type="email" 
                    placeholder="you@example.com" 
                    data-testid="input-login-email"
                    autoComplete="email"
                    className="h-11 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                    {...loginForm.register("email")}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm font-medium text-red-400">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-slate-200">Password</Label>
                  <Input 
                    id="login-password"
                    type="password" 
                    placeholder="••••••••" 
                    data-testid="input-login-password"
                    autoComplete="current-password"
                    className="h-11 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
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
                  className="w-full h-11 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold" 
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
                    <Label htmlFor="register-firstname" className="text-slate-200">First Name</Label>
                    <Input 
                      id="register-firstname"
                      placeholder="John" 
                      data-testid="input-register-firstname"
                      autoComplete="given-name"
                      className="h-11 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                      {...registerForm.register("firstName")}
                    />
                    {registerForm.formState.errors.firstName && (
                      <p className="text-sm font-medium text-red-400">
                        {registerForm.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-lastname" className="text-slate-200">Last Name</Label>
                    <Input 
                      id="register-lastname"
                      placeholder="Doe" 
                      data-testid="input-register-lastname"
                      autoComplete="family-name"
                      className="h-11 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
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
                  <Label htmlFor="register-email" className="text-slate-200">Email Address</Label>
                  <Input 
                    id="register-email"
                    type="email" 
                    placeholder="you@example.com" 
                    data-testid="input-register-email"
                    autoComplete="email"
                    className="h-11 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                    {...registerForm.register("email")}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-sm font-medium text-red-400">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-slate-200">Password</Label>
                  <Input 
                    id="register-password"
                    type="password" 
                    placeholder="••••••••" 
                    data-testid="input-register-password"
                    autoComplete="new-password"
                    className="h-11 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
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
                  className="w-full h-11 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold" 
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
              <span className="text-slate-400">
                {mode === "login" ? "Don't have an account?" : "Already have an account?"}
              </span>
              {" "}
              <button
                type="button"
                className="font-semibold text-cyan-400 hover:text-cyan-300 hover:underline focus:outline-none focus:underline"
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

            {/* Trust Badge */}
            <div className="pt-4 border-t border-slate-700">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Powered by Claude 4.5 Sonnet</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Links */}
        <div className="mt-6 text-center text-sm">
          <a 
            href="/" 
            className="text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1.5 hover:underline font-medium"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
