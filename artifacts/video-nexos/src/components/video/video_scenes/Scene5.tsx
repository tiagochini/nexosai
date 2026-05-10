import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video/animations';

const steps = [
  { num: "01", title: "Diagnóstico", sub: "IA analisa produto, mercado e viabilidade", color: "var(--color-primary)" },
  { num: "02", title: "Estratégia", sub: "Plano completo de 7 dias com gatilhos por fase", color: "var(--color-secondary)" },
  { num: "03", title: "Execução", sub: "Sequências automáticas WhatsApp + Email", color: "var(--color-accent)" },
];

export function Scene5() {
  const [phase, setPhase] = useState(0);

  // Slower — each card has time to breathe
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 4400),
      setTimeout(() => setPhase(4), 6200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg-dark px-12"
      {...sceneTransitions.splitHorizontal}
    >
      <motion.h2
        className="font-bold text-white uppercase tracking-widest text-center mb-12"
        style={{ fontSize: 'clamp(1.5rem, 3.5vw, 4rem)' }}
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        O Processo NexOS
      </motion.h2>

      <div className="flex justify-center gap-6 w-full max-w-7xl">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            className="flex-1 border border-white/10 bg-white/5 backdrop-blur-sm p-8 relative overflow-hidden flex flex-col gap-3"
            initial={{ opacity: 0, y: 60 }}
            animate={phase > i ? { opacity: 1, y: 0 } : {}}
            transition={{ ...springs.smooth, duration: 0.7 }}
          >
            <span
              className="font-black text-white/20 leading-none"
              style={{ fontSize: 'clamp(2rem, 5vw, 6rem)' }}
            >
              {step.num}
            </span>
            <h3
              className="font-black text-white"
              style={{ fontSize: 'clamp(1.2rem, 2.8vw, 3.2rem)', color: step.color }}
            >
              {step.title}
            </h3>
            <p
              className="text-text-muted leading-relaxed"
              style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1.6rem)' }}
            >
              {step.sub}
            </p>
            {/* Progress bar */}
            <div className="h-[3px] w-full bg-white/10 mt-auto rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: step.color }}
                initial={{ width: 0 }}
                animate={phase > i ? { width: '100%' } : {}}
                transition={{ duration: 1.2, delay: 0.4, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-14 flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={phase >= 4 ? { opacity: 1, scale: 1 } : {}}
        transition={{ ...springs.bouncy, duration: 0.6 }}
      >
        <span
          className="text-accent font-black uppercase tracking-tighter text-center"
          style={{ fontSize: 'clamp(1.5rem, 4vw, 5rem)' }}
        >
          Em apenas 7 dias
        </span>
        <div className="h-[3px] w-56 bg-accent mt-3 rounded-full" />
      </motion.div>
    </motion.div>
  );
}
