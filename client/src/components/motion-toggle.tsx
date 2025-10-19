import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";

export function MotionToggle() {
  const [motionReduced, setMotionReduced] = useState(false);

  useEffect(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem("reduceMotion");
    if (saved === "true") {
      setMotionReduced(true);
      document.body.classList.add("reduce-motion");
    }
    
    // Also check system preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion && saved !== "false") {
      setMotionReduced(true);
      document.body.classList.add("reduce-motion");
    }
  }, []);

  const toggleMotion = () => {
    const newValue = !motionReduced;
    setMotionReduced(newValue);
    
    if (newValue) {
      document.body.classList.add("reduce-motion");
      localStorage.setItem("reduceMotion", "true");
    } else {
      document.body.classList.remove("reduce-motion");
      localStorage.setItem("reduceMotion", "false");
    }
  };

  return (
    <Button
      variant={motionReduced ? "default" : "secondary"}
      size="default"
      onClick={toggleMotion}
      aria-pressed={motionReduced}
      aria-label={motionReduced ? "Enable animations" : "Reduce motion (for accessibility)"}
      title={motionReduced ? "Enable animations" : "Reduce motion (helps with motion sensitivity, epilepsy, vestibular disorders)"}
      data-testid="button-motion-toggle"
      className={`gap-2 border-2 min-h-[44px] ${motionReduced ? 'border-cyan-500' : 'border-amber-500/50'}`}
    >
      {motionReduced ? (
        <>
          <Play className="w-4 h-4" />
          <span className="hidden md:inline">Motion Off</span>
        </>
      ) : (
        <>
          <Pause className="w-4 h-4 text-amber-400" />
          <span className="hidden md:inline text-amber-400">Motion</span>
        </>
      )}
    </Button>
  );
}
