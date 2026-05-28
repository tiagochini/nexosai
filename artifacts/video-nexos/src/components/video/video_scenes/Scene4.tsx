import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video/animations';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg-dark"
      {...sceneTransitions.morphExpand}
    >
      <div className="flex flex-col items-center justify-center text-center w-full px-16 gap-12">

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
          transition={{ ...springs.smooth, duration: 0.8 }}
          className="flex flex-col items-center"
        >
          <h2
            className="font-black text-white leading-none text-center"
            style={{ fontSize: 'clamp(3rem, 8vw, 9rem)' }}
          >
            34
          </h2>
          <span
            className="text-primary font-black uppercase tracking-widest text-center"
            style={{ fontSize: 'clamp(1.2rem, 3.5vw, 4rem)' }}
          >
            Agentes Especializados
          </span>
          <p
            className="text-text-muted text-center mt-4 max-w-lg"
            style={{ fontSize: 'clamp(0.9rem, 1.8vw, 2rem)' }}
          >
            Estratégia, copy, sequências, tráfego, analytics e vendas — cada agente treinado nas doutrinas dos maiores profissionais do mundo.
          </p>
        </motion.div>

        {/* Orbital nodes centered */}
        <motion.div
          className="relative flex items-center justify-center"
          style={{ width: '40vw', height: '40vw', maxWidth: '420px', maxHeight: '420px' }}
          initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1, rotate: 0 } : {}}
          transition={springs.bouncy}
        >
          <div className="absolute inset-0 bg-primary/15 rounded-full blur-3xl animate-pulse" />

          {/* Center circle */}
          <div
            className="absolute rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center"
            style={{ width: '35%', height: '35%' }}
          >
            <span className="font-black text-primary" style={{ fontSize: 'clamp(1rem, 3vw, 3rem)' }}>AI</span>
          </div>

          {/* Orbit ring */}
          <div className="absolute inset-0 rounded-full border border-primary/20" />

          {/* Orbital nodes */}
          {[...Array(8)].map((_, i) => {
            const angle = (i * 45) * Math.PI / 180;
            const r = 48;
            return (
              <motion.div
                key={i}
                className="absolute w-5 h-5 bg-secondary rounded-full shadow-lg"
                style={{
                  left: `calc(50% + ${Math.cos(angle) * r}% - 10px)`,
                  top: `calc(50% + ${Math.sin(angle) * r}% - 10px)`,
                  boxShadow: '0 0 12px var(--color-secondary)',
                }}
                animate={{
                  scale: [0.8, 1.4, 0.8],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3 }}
              />
            );
          })}
        </motion.div>
      </div>
    </motion.div>
  );
}
