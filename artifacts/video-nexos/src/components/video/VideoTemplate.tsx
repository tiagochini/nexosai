import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';

export const SCENE_DURATIONS = {
  tension: 8000,
  pain: 12000,
  shift: 8000,
  platform: 8000,
  process: 10000,
  close: 8000,
};

const bgVideo = `${import.meta.env.BASE_URL}videos/bg_cinematic.mp4`;

const FullscreenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const ExitFullscreenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="10" y1="14" x2="3" y2="21" />
    <line x1="21" y1="3" x2="14" y2="10" />
  </svg>
);

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2500);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for browser's native exit (Esc key)
  useState(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  });

  return (
    <div
      ref={containerRef}
      className="w-full h-screen overflow-hidden relative bg-bg-dark select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
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
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full bg-primary/10 blur-[120px]"
          animate={{ x: ['-20%', '30%', '0%'], y: ['-10%', '20%', '10%'] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full bg-secondary/5 blur-[100px] bottom-0 right-0"
          animate={{ x: ['20%', '-10%', '10%'], y: ['10%', '-20%', '0%'] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(var(--color-primary) 1px, transparent 1px)',
          backgroundSize: '4vw 4vw',
        }}
      />

      {/* Scenes */}
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

      {/* Fullscreen button */}
      <AnimatePresence>
        {showControls && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            onClick={toggleFullscreen}
            className="absolute bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 bg-black/40 backdrop-blur-md text-white/80 hover:text-white hover:bg-black/60 hover:border-primary/50 transition-colors cursor-pointer"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            <span className="text-sm font-medium tracking-wide">
              {isFullscreen ? 'Sair' : 'Tela cheia'}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
