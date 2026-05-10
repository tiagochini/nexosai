import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video/animations';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1800),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ backgroundColor: '#0a0a12' }}
      animate={phase >= 1 ? { backgroundColor: '#10101e' } : {}}
      transition={{ duration: 2 }}
    >
      {/* Light Flood from top */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/5 to-transparent pointer-events-none"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 2.5 }}
      />

      <div className="flex flex-col items-center justify-center text-center relative z-10 w-full px-12">
        {/* Question */}
        <motion.p
          className="font-medium text-secondary text-center"
          style={{ fontSize: 'clamp(1.5rem, 4.5vw, 5rem)' }}
          initial={{ opacity: 0, y: 30 }}
          animate={phase === 2 ? { opacity: 1, y: 0 } : phase > 2 ? { opacity: 0, y: -20, scale: 0.95 } : { opacity: 0 }}
          transition={{ ...springs.smooth, duration: 0.8 }}
        >
          E se uma IA fizesse tudo isso por você?
        </motion.p>

        {/* Logo reveal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.4 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : {}}
          transition={springs.bouncy}
          className="flex flex-col items-center"
        >
          <div className="relative p-14 flex items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/25 blur-3xl"
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <h1
              className="font-black tracking-tighter text-white leading-none relative"
              style={{ fontSize: 'clamp(3.5rem, 11vw, 12rem)' }}
            >
              NexOS <span className="text-primary">AI</span>
            </h1>
          </div>
          <motion.p
            className="text-secondary uppercase font-bold tracking-[0.5em]"
            style={{ fontSize: 'clamp(0.8rem, 2vw, 2.2rem)' }}
            initial={{ opacity: 0, letterSpacing: '0.1em' }}
            animate={phase >= 3 ? { opacity: 1, letterSpacing: '0.5em' } : {}}
            transition={{ delay: 0.6, duration: 1.2 }}
          >
            Plataforma de Lançamento
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}
