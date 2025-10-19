import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { trackConversion } from "@/lib/ga4";
import { Mail, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface LeadCaptureFormProps {
  source?: string;
  placeholder?: string;
  buttonText?: string;
  className?: string;
}

export function LeadCaptureForm({ 
  source = "landing_page", 
  placeholder = "Enter your email",
  buttonText = "Get Started Free",
  className = ""
}: LeadCaptureFormProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          source,
          metadata: {
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            timestamp: new Date().toISOString(),
          }
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save email');
      }

      // Track lead capture conversion (NO PII)
      trackConversion.leadCapture(source);

      toast({
        title: "🎉 You're on the list!",
        description: "Check your email for your exclusive early access link",
      });

      // Redirect to builder after successful signup
      setTimeout(() => {
        window.location.href = '/builder';
      }, 1500);

      setEmail("");
    } catch (error: any) {
      toast({
        title: "Oops!",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            className="pl-10 h-12 text-base bg-slate-800/50 border-slate-700 focus:border-cyan-500 transition-colors"
            disabled={isSubmitting}
            data-testid="input-email-capture"
            required
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-12 px-6 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold"
          disabled={isSubmitting}
          data-testid="button-submit-email"
        >
          {isSubmitting ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="mr-2"
              >
                <Sparkles className="w-4 h-4" />
              </motion.div>
              Joining...
            </>
          ) : (
            <>
              {buttonText}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
