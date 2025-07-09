'use client';

import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useGlobalStore } from '../store/global';

export default function SpatialAudioBackground() {
  const spatialConfig = useGlobalStore((state) => state.spatialConfig);
  const isSpatialAudioEnabled = useGlobalStore((state) => state.isSpatialAudioEnabled);
  
  // Mock gain value for visual effect
  const gain = isSpatialAudioEnabled ? 0.8 : 0;

  // If gain is 0, don't render anything
  if (gain <= 0) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: gain }}
        transition={{ duration: 1.5 }}
        className="fixed inset-0 pointer-events-none -z-10 bg-gradient-to-br from-blue-600/50 via-pink-500/30 to-blue-400/25 blur-lg"
      />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: gain }}
        transition={{ duration: 1.2 }}
        className="fixed inset-0 pointer-events-none -z-10 bg-radial-gradient from-pink-600/50 via-transparent to-transparent blur-xl mix-blend-screen"
      />

      {/* Additional animated spots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: [gain * 0.6, gain, gain * 0.6],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="fixed top-[10%] left-[15%] w-[30vw] h-[30vw] rounded-full bg-pink-600/20 blur-3xl pointer-events-none -z-10"
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: [gain * 0.5, gain * 0.9, gain * 0.5],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        className="fixed bottom-[20%] right-[10%] w-[25vw] h-[25vw] rounded-full bg-purple-600/20 blur-3xl pointer-events-none -z-10"
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: [gain * 0.4, gain * 0.8, gain * 0.4],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 4,
        }}
        className="fixed top-[40%] right-[20%] w-[20vw] h-[20vw] rounded-full bg-blue-500/20 blur-3xl pointer-events-none -z-10"
      />
    </>
  );
}
