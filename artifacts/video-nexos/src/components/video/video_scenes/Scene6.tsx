import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video/animations';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 4500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg-dark overflow-hidden"
      {...sceneTransitions.scaleFade}
    >
      {/* Glow background */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(108,71,255,0.12) 0%, transparent 70%)' }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      <div className="flex flex-col items-center justify-center text-center z-10 gap-10 px-12">
        {/* Main tagline */}
        <motion.h2
          className="font-black text-white leading-tight tracking-tight text-center"
          style={{ fontSize: 'clamp(2.5rem, 7vw, 8rem)' }}
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
          transition={{ ...springs.smooth, duration: 1 }}
        >
          Seu produto digital<br />
          <span className="text-primary italic">no ar em 7 dias.</span>
        </motion.h2>

        {/* Logo box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1 } : {}}
          transition={{ ...springs.bouncy, duration: 0.8 }}
        >
          <div className="px-12 py-6 border-2 border-primary/50 bg-primary/10 backdrop-blur-md">
            <span
              className="font-black tracking-tighter text-white"
              style={{ fontSize: 'clamp(2rem, 5vw, 6rem)' }}
            >
              NexOS <span className="text-primary">AI</span>
            </span>
          </div>
        </motion.div>

        {/* URL */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={phase >= 3 ? { opacity: 1 } : {}}
          transition={{ duration: 1 }}
        >
          <motion.p
            className="text-secondary font-mono uppercase"
            style={{ fontSize: 'clamp(0.9rem, 2vw, 2.2rem)', letterSpacing: '0.4em' }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            nexos.ai
          </motion.p>
        </motion.div>
      </div>

      {/* Scanline */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-primary/30 pointer-events-none"
        style={{ top: '0%' }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  );
}
