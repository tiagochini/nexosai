import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video/animations';

const steps = [
  {
    num: "01",
    title: "Diagnóstico",
    sub: "IA analisa produto, mercado e viabilidade",
    color: "#6C47FF",
  },
  {
    num: "02",
    title: "Estratégia",
    sub: "Plano completo de 7 dias com gatilhos por fase",
    color: "#00D4FF",
  },
  {
    num: "03",
    title: "Execução",
    sub: "Sequências automáticas WhatsApp + Email",
    color: "#00E5A0",
  },
];

export function Scene5() {
  const [phase, setPhase] = useState(0);

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
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg-dark"
      style={{ padding: '3vh 4vw' }}
      {...sceneTransitions.splitHorizontal}
    >
      {/* Title */}
      <motion.h2
        className="font-bold text-white uppercase tracking-widest text-center"
        style={{ fontSize: 'clamp(1.2rem, 2.8vw, 3rem)', marginBottom: '3vh' }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        O Processo NexOS
      </motion.h2>

      {/* Cards — vertical stack to avoid overflow */}
      <div
        className="w-full flex flex-col gap-4"
        style={{ maxWidth: '860px' }}
      >
        {steps.map((step, i) => (
          <motion.div
            key={i}
            className="w-full flex items-center gap-6 border border-white/10 bg-white/5 backdrop-blur-sm relative overflow-hidden"
            style={{ padding: '2.5vh 2.5vw', borderRadius: '12px' }}
            initial={{ opacity: 0, x: -60 }}
            animate={phase > i ? { opacity: 1, x: 0 } : {}}
            transition={{ ...springs.smooth, duration: 0.6 }}
          >
            {/* Colored left accent */}
            <motion.div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
              style={{ backgroundColor: step.color }}
              initial={{ scaleY: 0 }}
              animate={phase > i ? { scaleY: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
            />

            {/* Number */}
            <span
              className="font-black shrink-0"
              style={{
                fontSize: 'clamp(2rem, 5vw, 5.5rem)',
                color: step.color,
                opacity: 0.25,
                lineHeight: 1,
                minWidth: '3ch',
                textAlign: 'right',
              }}
            >
              {step.num}
            </span>

            {/* Text */}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <h3
                className="font-black text-white leading-none"
                style={{ fontSize: 'clamp(1.2rem, 2.8vw, 3rem)', color: step.color }}
              >
                {step.title}
              </h3>
              <p
                className="text-white/50"
                style={{ fontSize: 'clamp(0.75rem, 1.4vw, 1.5rem)' }}
              >
                {step.sub}
              </p>
            </div>

            {/* Progress bar */}
            <div
              className="h-[3px] absolute bottom-0 left-0 right-0 bg-white/5"
            >
              <motion.div
                className="h-full"
                style={{ backgroundColor: step.color }}
                initial={{ width: 0 }}
                animate={phase > i ? { width: '100%' } : {}}
                transition={{ duration: 1.5, delay: 0.4, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* "Em 7 dias" badge */}
      <motion.div
        className="flex flex-col items-center"
        style={{ marginTop: '3vh' }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={phase >= 4 ? { opacity: 1, scale: 1 } : {}}
        transition={{ ...springs.bouncy, duration: 0.6 }}
      >
        <span
          className="font-black uppercase tracking-tighter text-center"
          style={{ fontSize: 'clamp(1.4rem, 3.5vw, 4rem)', color: '#00E5A0' }}
        >
          Em apenas 7 dias
        </span>
        <div className="h-[3px] w-48 mt-2 rounded-full" style={{ backgroundColor: '#00E5A0' }} />
      </motion.div>
    </motion.div>
  );
}
