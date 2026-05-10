import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions, springs } from '@/lib/video/animations';

export function Scene6() {
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
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg-dark overflow-hidden"
      {...sceneTransitions.scaleFade}
    >
      <motion.div
        className="absolute inset-0 bg-primary opacity-5"
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.05, 0.1, 0.05]
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <div className="text-center z-10">
        <motion.h2
          className="text-[6vw] font-black text-white leading-none tracking-tight mb-4"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
          transition={springs.smooth}
        >
          Seu produto digital no ar em <span className="text-primary italic">7 dias.</span>
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1 } : {}}
          transition={springs.bouncy}
          className="mt-12"
        >
          <div className="flex flex-col items-center">
             <div className="px-10 py-4 border-2 border-primary/50 rounded-xl bg-primary/10 backdrop-blur-md">
                <span className="text-[4vw] font-black tracking-tighter text-white">
                  NexOS <span className="text-primary">AI</span>
                </span>
             </div>
             <motion.p
                className="mt-6 text-[2vw] text-secondary font-mono tracking-widest"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
             >
                nexos.ai
             </motion.p>
          </div>
        </motion.div>
      </div>

      {/* Finishing scanline */}
      <motion.div 
        className="absolute top-0 left-0 right-0 h-1 bg-primary/20 pointer-events-none"
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
    </motion.div>
  );
}
