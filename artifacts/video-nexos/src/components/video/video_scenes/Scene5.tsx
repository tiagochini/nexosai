import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video/animations';

const steps = [
  { title: "Diagnóstico", icon: "🔍", color: "var(--color-primary)" },
  { title: "Estratégia", icon: "📐", color: "var(--color-secondary)" },
  { title: "Execução", icon: "🚀", color: "var(--color-accent)" }
];

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 1900),
      setTimeout(() => setPhase(4), 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg-dark px-20"
      {...sceneTransitions.splitHorizontal}
    >
      <motion.h2 
        className="text-[4vw] font-bold text-white mb-16 uppercase tracking-widest"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        O Processo NexOS
      </motion.h2>

      <div className="flex justify-between w-full max-w-6xl gap-8">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            className="flex-1 bg-bg-muted/50 border border-white/10 p-10 rounded-2xl relative overflow-hidden group"
            initial={{ opacity: 0, y: 50 }}
            animate={phase > i ? { opacity: 1, y: 0 } : {}}
            transition={springs.smooth}
          >
            <motion.div 
              className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"
            />
            <div className="text-[5vw] mb-6">{step.icon}</div>
            <h3 className="text-[2.5vw] font-bold text-white mb-2">{step.title}</h3>
            <div 
              className="h-1 w-full bg-white/10 mt-4 rounded-full overflow-hidden"
            >
              <motion.div 
                className="h-full"
                style={{ backgroundColor: step.color }}
                initial={{ width: 0 }}
                animate={phase > i ? { width: '100%' } : {}}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-20 flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={phase >= 4 ? { opacity: 1, scale: 1 } : {}}
        transition={springs.bouncy}
      >
        <span className="text-accent text-[3vw] font-black uppercase tracking-tighter">
          Em apenas 7 dias
        </span>
        <div className="h-[2px] w-48 bg-accent mt-2" />
      </motion.div>
    </motion.div>
  );
}
