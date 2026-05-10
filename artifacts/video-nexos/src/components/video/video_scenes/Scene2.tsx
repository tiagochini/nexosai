import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video/animations';

const problems = [
  { text: "Sem estratégia.", color: "#6C47FF" },
  { text: "Sem copy.", color: "#00D4FF" },
  { text: "Sem time.", color: "#FF4747" },
  { text: "Sem escala.", color: "#00E5A0" },
  { text: "Sem lucro.", color: "#FF9500" },
];

export function Scene2() {
  const [index, setIndex] = useState(0);

  // Slow down — each word stays 2.2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % problems.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg-dark"
      {...sceneTransitions.splitVertical}
    >
      {/* Counter */}
      <div className="absolute top-12 left-0 right-0 flex justify-center">
        <div className="flex gap-3">
          {problems.map((_, i) => (
            <motion.div
              key={i}
              className="h-[3px] w-12 rounded-full"
              animate={{ backgroundColor: i === index ? '#6C47FF' : 'rgba(255,255,255,0.15)' }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatePresence mode="popLayout">
          <motion.h2
            key={index}
            initial={{ opacity: 0, y: 60, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 1.1 }}
            transition={{ ...springs.stiff, duration: 0.5 }}
            className="font-black uppercase tracking-tighter text-center w-full"
            style={{
              fontSize: 'clamp(3rem, 9vw, 10rem)',
              color: problems[index].color,
              fontFamily: 'var(--font-display)',
              textShadow: `0 0 80px ${problems[index].color}80`,
            }}
          >
            {problems[index].text}
          </motion.h2>
        </AnimatePresence>
      </div>

      {/* Subtle flash */}
      <motion.div
        className="absolute inset-0 bg-white pointer-events-none"
        key={index}
        initial={{ opacity: 0.08 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      />
    </motion.div>
  );
}
