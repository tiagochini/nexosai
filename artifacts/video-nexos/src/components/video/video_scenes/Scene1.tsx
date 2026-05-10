import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

const lines = [
  { text: "Você já perdeu vendas online", color: "white" },
  { text: "por não entender como", color: "white" },
  { text: "funciona um lançamento?", color: "var(--color-primary)" },
];

export function Scene1() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setVisibleLines(1), 500),
      setTimeout(() => setVisibleLines(2), 2000),
      setTimeout(() => setVisibleLines(3), 3500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-bg-dark"
      {...sceneTransitions.fadeBlur}
    >
      <div className="relative z-10 flex flex-col items-center justify-center text-center w-full px-16 gap-4">
        {lines.map((line, i) => (
          <AnimatePresence key={i}>
            {visibleLines > i && (
              <motion.h1
                initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="font-black text-center leading-tight tracking-tight"
                style={{
                  fontSize: 'clamp(2.2rem, 6.5vw, 7.5rem)',
                  color: line.color,
                  textShadow: i === 2 ? '0 0 80px rgba(108,71,255,0.5)' : 'none',
                }}
              >
                {line.text}
              </motion.h1>
            )}
          </AnimatePresence>
        ))}
      </div>

      {/* Scan line */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-primary/30 pointer-events-none"
        animate={{ top: ['0%', '100%'] }}
        style={{ top: '0%' }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />

      {/* Subtle glitch overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(108,71,255,0.04) 4px)',
        }}
      />
    </motion.div>
  );
}
