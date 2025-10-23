import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Package, FolderCode, CheckCircle2, Rocket } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UploadLoaderProps {
  isOpen: boolean;
  progress?: number;
}

const UPLOAD_MESSAGES = [
  { text: "Unpacking your awesome code...", icon: Package },
  { text: "Analyzing file structure...", icon: FolderCode },
  { text: "Setting up your workspace...", icon: Sparkles },
  { text: "Almost there! Getting everything ready...", icon: Rocket },
  { text: "Finalizing your project...", icon: CheckCircle2 },
];

export function UploadLoader({ isOpen, progress = 0 }: UploadLoaderProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentMessageIndex(0);
      setIsVisible(false);
      return;
    }

    setIsVisible(true);

    // Rotate messages every 1.5 seconds
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % UPLOAD_MESSAGES.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [isOpen]);

  const currentMessage = UPLOAD_MESSAGES[currentMessageIndex];
  const MessageIcon = currentMessage.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          data-testid="upload-loader-overlay"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative max-w-md w-full mx-4"
          >
            <div className="bg-card border rounded-lg shadow-lg p-8 space-y-6">
              {/* Animated Spinner */}
              <div className="flex justify-center">
                <div className="relative">
                  <Loader2 className="w-16 h-16 text-primary animate-spin" data-testid="upload-spinner" />
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
                  />
                </div>
              </div>

              {/* Rotating Message */}
              <div className="relative h-24 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentMessageIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 flex flex-col items-center justify-center text-center"
                  >
                    <MessageIcon className="w-8 h-8 text-primary mb-3" />
                    <p className="text-lg font-medium" data-testid="upload-message">
                      {currentMessage.text}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress 
                  value={Math.min(progress, 100)} 
                  className="h-2"
                  data-testid="upload-progress"
                />
                <p className="text-xs text-center text-muted-foreground">
                  {progress > 0 ? `${Math.min(Math.round(progress), 100)}%` : 'Starting upload...'}
                </p>
              </div>

              {/* Animated Dots */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 1, 0.3]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2
                    }}
                    className={cn(
                      "w-2 h-2 rounded-full",
                      currentMessageIndex === i ? "bg-primary" : "bg-muted-foreground"
                    )}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
