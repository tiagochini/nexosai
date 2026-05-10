import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';

export const SCENE_DURATIONS = {
  tension: 8000,   // Scene 1 — opening question, needs time to read
  pain: 12000,     // Scene 2 — 5 words × 2.2s + entrance
  shift: 8000,     // Scene 3 — light flood + logo reveal
  platform: 8000,  // Scene 4 — 29 agents + orbital nodes
  process: 10000,  // Scene 5 — 3 steps, each has 1.9s gap + "7 dias"
  close: 8000,     // Scene 6 — tagline + logo + URL
};

const bgVideo = `${import.meta.env.BASE_URL}videos/bg_cinematic.mp4`;

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
    <div className="w-full h-screen overflow-hidden relative bg-bg-dark">
      {/* Persistent Background Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video 
          src={bgVideo} 
          autoPlay 
          muted 
          loop 
          playsInline
          className="w-full h-full object-cover opacity-30 mix-blend-screen"
        />
        
        {/* Animated Orbs */}
        <motion.div 
          className="absolute w-[80vw] h-[80vw] rounded-full bg-primary/10 blur-[120px]"
          animate={{
            x: ['-20%', '30%', '0%'],
            y: ['-10%', '20%', '10%'],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute w-[60vw] h-[60vw] rounded-full bg-secondary/5 blur-[100px] bottom-0 right-0"
          animate={{
            x: ['20%', '-10%', '10%'],
            y: ['10%', '-20%', '0%'],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 z-1 pointer-events-none opacity-20"
        style={{ 
          backgroundImage: `radial-gradient(var(--color-primary) 1px, transparent 1px)`,
          backgroundSize: '4vw 4vw'
        }}
      />

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="tension" />}
        {currentScene === 1 && <Scene2 key="pain" />}
        {currentScene === 2 && <Scene3 key="shift" />}
        {currentScene === 3 && <Scene4 key="platform" />}
        {currentScene === 4 && <Scene5 key="process" />}
        {currentScene === 5 && <Scene6 key="close" />}
      </AnimatePresence>
      
      {/* Noise Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
