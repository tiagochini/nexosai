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

      <div className="flex flex-col items-center justify-center text-center z-10 gap-8 px-12">
        {/* Main tagline */}
        <motion.h2
          className="font-black text-white leading-tight tracking-tight text-center"
          style={{ fontSize: 'clamp(2.2rem, 6vw, 7rem)' }}
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
          transition={{ ...springs.smooth, duration: 1 }}
        >
          Do briefing ao carrinho fechado.<br />
          <span className="text-primary italic">Em 7 dias.</span>
        </motion.h2>

        {/* Tracks */}
        <motion.div
          className="flex gap-4 flex-wrap justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : {}}
          transition={{ ...springs.smooth, duration: 0.8 }}
        >
          {[
            { track: "6 dígitos", range: "R$100k–R$999k", color: "#00E5A0" },
            { track: "8 dígitos", range: "R$10M–R$99M", color: "#6C47FF" },
            { track: "10 dígitos", range: "R$100M+", color: "#00D4FF" },
          ].map((t) => (
            <div
              key={t.track}
              className="flex flex-col items-center px-6 py-3 border border-white/10 bg-white/5"
              style={{ borderLeft: `3px solid ${t.color}` }}
            >
              <span className="font-black text-white" style={{ fontSize: 'clamp(0.9rem, 2vw, 1.8rem)', color: t.color }}>{t.track}</span>
              <span className="text-white/40 font-mono uppercase" style={{ fontSize: 'clamp(0.6rem, 1.1vw, 1rem)', letterSpacing: '0.1em' }}>{t.range}</span>
            </div>
          ))}
        </motion.div>

        {/* Logo box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : {}}
          transition={{ ...springs.bouncy, duration: 0.8 }}
        >
          <div className="px-12 py-5 border-2 border-primary/50 bg-primary/10 backdrop-blur-md">
            <span
              className="font-black tracking-tighter text-white"
              style={{ fontSize: 'clamp(2rem, 5vw, 6rem)' }}
            >
              NexOS <span className="text-primary">AI</span>
            </span>
            <motion.p
              className="text-secondary font-mono uppercase text-center mt-1"
              style={{ fontSize: 'clamp(0.7rem, 1.3vw, 1.3rem)', letterSpacing: '0.4em' }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              nexos.ai
            </motion.p>
          </div>
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
