import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions, springs, staggerConfigs } from '@/lib/video/animations';

const agentsIcon = `${import.meta.env.BASE_URL}images/agents_node.png`;

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-bg-dark"
      {...sceneTransitions.morphExpand}
    >
      <div className="grid grid-cols-2 gap-20 items-center px-20 w-full max-w-7xl">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : {}}
          transition={springs.smooth}
        >
          <h2 className="text-[6vw] font-black text-white leading-none mb-4">
            29 <span className="text-primary text-[4vw] block">Agentes Especializados</span>
          </h2>
          <p className="text-[1.8vw] text-text-muted max-w-md">
            Trabalhando 24/7 para construir cada detalhe do seu lançamento.
          </p>
        </motion.div>

        <motion.div
          className="relative aspect-square flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1, rotate: 0 } : {}}
          transition={springs.bouncy}
        >
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <img 
            src={agentsIcon} 
            className="w-full h-full object-contain relative z-10" 
            alt="AI Agents"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          
          {/* Orbital nodes */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-4 h-4 bg-secondary rounded-full"
              animate={{
                x: Math.cos((i * 60) * Math.PI / 180) * 200,
                y: Math.sin((i * 60) * Math.PI / 180) * 200,
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.2
              }}
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
