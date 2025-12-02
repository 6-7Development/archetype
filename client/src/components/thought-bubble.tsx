/**
 * Thought Bubble Component
 * =======================
 * Displays mascot thoughts above the bee with smooth fade in/out
 */

import { motion, AnimatePresence } from 'framer-motion';

interface ThoughtBubbleProps {
  text: string;
  isVisible: boolean;
  offsetX?: number;
  offsetY?: number;
  maxWidth?: number;
  fontSize?: number;
  backgroundColor?: string;
  textColor?: string;
  zIndex?: number;
}

export function ThoughtBubble({
  text,
  isVisible,
  offsetX = 0,
  offsetY = -60,
  maxWidth = 280,
  fontSize = 13,
  backgroundColor = 'rgba(0,0,0,0.8)',
  textColor = 'rgba(255,255,255,0.95)',
  zIndex = 105,
}: ThoughtBubbleProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed pointer-events-none"
          style={{
            zIndex,
            transform: `translate(${offsetX}px, ${offsetY}px)`,
          }}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -10 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {/* Bubble container */}
          <div
            style={{
              maxWidth,
              padding: '12px 16px',
              borderRadius: '16px',
              backgroundColor,
              textColor,
              fontSize: `${fontSize}px`,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: '1.4',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              border: '2px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ color: textColor }}>{text}</div>

            {/* Tail pointing down to mascot */}
            <div
              style={{
                position: 'absolute',
                bottom: '-8px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: `8px solid ${backgroundColor}`,
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ThoughtBubble;
