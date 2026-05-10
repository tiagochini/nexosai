import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video/animations';

const problems = [
  "Sem estratégia.",
  "Sem copy.",
  "Sem time.",
  "Sem escala.",
  "Sem lucro."
];

export function Scene2() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % problems.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-bg-dark"
      {...sceneTransitions.splitVertical}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatePresence mode="popLayout">
          <motion.h2
            key={index}
            initial={{ opacity: 0, scale: 0.8, x: index % 2 === 0 ? -100 : 100 }}
            animate={{ opacity: 1, scale: 1.2, x: 0 }}
            exit={{ opacity: 0, scale: 1.5, x: index % 2 === 0 ? 100 : -100 }}
            transition={{ ...springs.stiff, duration: 0.4 }}
            className="text-[8vw] font-black text-primary uppercase tracking-tighter italic"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {problems[index]}
          </motion.h2>
        </AnimatePresence>
      </div>

      {/* Flash effect */}
      <motion.div
        className="absolute inset-0 bg-white pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.1, 0] }}
        transition={{ duration: 0.1, repeat: problems.length, repeatDelay: 1.1 }}
      />
    </motion.div>
  );
}
