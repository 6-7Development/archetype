import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function PricingSuccess() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        <Card className="p-12 text-center bg-card/50 border-cyan-500/30">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center"
          >
            <CheckCircle className="w-16 h-16 text-cyan-400" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-bold mb-4"
          >
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Welcome to Lomu Pro!
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-slate-300 mb-8"
          >
            Your subscription is now active. You're ready to build amazing projects with AI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-4"
          >
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 border-0"
              data-testid="button-start-building"
              asChild
            >
              <Link href="/builder">
                Start Building Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="w-full"
              data-testid="button-view-account"
              asChild
            >
              <Link href="/account">
                View Account & Usage
              </Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 p-6 bg-cyan-500/10 border border-cyan-500/20 rounded-lg"
          >
            <h3 className="font-semibold text-cyan-400 mb-2">What's Next?</h3>
            <ul className="text-sm text-slate-400 space-y-2 text-left">
              <li>✅ Your AI credits have been added to your account</li>
              <li>✅ Access to all Pro features is now enabled</li>
              <li>✅ Priority support is available in your dashboard</li>
            </ul>
          </motion.div>

          <p className="text-sm text-slate-500 mt-6">
            Questions? Email us at{" "}
            <a href="mailto:support@archetypeai.dev" className="text-cyan-400 hover:underline">
              support@archetypeai.dev
            </a>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
