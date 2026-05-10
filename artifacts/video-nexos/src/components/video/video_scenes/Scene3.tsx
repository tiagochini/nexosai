import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video/animations';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500), // Light flood
      setTimeout(() => setPhase(2), 1500), // Question
      setTimeout(() => setPhase(3), 3500), // Logo reveal
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ backgroundColor: '#0a0a12' }}
      animate={phase >= 1 ? { backgroundColor: '#151520' } : {}}
      transition={{ duration: 1.5 }}
    >
      {/* Light Flood */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 2 }}
      />

      <div className="text-center relative z-10">
        <motion.p
          className="text-[4vw] font-medium text-secondary mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={phase === 2 ? { opacity: 1, y: 0 } : phase > 2 ? { opacity: 0, y: -20 } : { opacity: 0 }}
          transition={springs.smooth}
        >
          E se uma IA fizesse tudo isso por você?
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : {}}
          transition={springs.bouncy}
          className="flex flex-col items-center"
        >
           <div className="bg-primary/10 p-12 rounded-full border border-primary/30 relative">
              <motion.div 
                className="absolute inset-0 rounded-full bg-primary/20 blur-3xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <h1 className="text-[10vw] font-black tracking-tighter text-white leading-none relative">
                NexOS <span className="text-primary">AI</span>
              </h1>
           </div>
           <motion.p 
              className="mt-6 text-[2vw] tracking-[0.5em] text-secondary uppercase font-bold"
              initial={{ letterSpacing: "0.1em", opacity: 0 }}
              animate={phase >= 3 ? { letterSpacing: "0.5em", opacity: 1 } : {}}
              transition={{ delay: 0.5, duration: 1 }}
            >
              Plataforma de Lançamento
           </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}
