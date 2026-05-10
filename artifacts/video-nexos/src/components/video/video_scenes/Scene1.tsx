import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { charVariants, charContainerVariants, sceneTransitions } from '@/lib/video/animations';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 3500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const text = "Você já perdeu um lançamento por falta de equipe?";

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-bg-dark"
      {...sceneTransitions.fadeBlur}
    >
      <div className="relative z-10 text-center px-12 max-w-4xl">
        <motion.h1
          className="text-[5vw] font-bold text-white tracking-tight leading-tight"
          variants={charContainerVariants}
          initial="hidden"
          animate={phase >= 1 ? "visible" : "hidden"}
        >
          {text.split(' ').map((word, i) => (
            <span key={i} className="inline-block mr-[0.5em] whitespace-nowrap">
              {word.split('').map((char, j) => (
                <motion.span
                  key={j}
                  variants={charVariants}
                  className="inline-block"
                >
                  {char}
                </motion.span>
              ))}
            </span>
          ))}
        </motion.h1>
      </div>

      {/* Glitch lines */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-10"
        animate={{
          background: [
            'repeating-linear-gradient(0deg, transparent 0px, transparent 1px, rgba(108, 71, 255, 0.1) 2px)',
            'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(108, 71, 255, 0.1) 3px)',
          ]
        }}
        transition={{ duration: 0.1, repeat: Infinity }}
      />
    </motion.div>
  );
}
