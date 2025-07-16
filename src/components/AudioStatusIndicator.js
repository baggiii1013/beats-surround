'use client';

import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { useGlobalStore } from '../store/global';

export default function AudioStatusIndicator() {
  const audioPlayer = useGlobalStore((state) => state.audioPlayer);
  const isInitingAudioContext = useGlobalStore((state) => state.isInitingAudioContext);
  const audioSourcesLoaded = useGlobalStore((state) => state.audioSourcesLoaded);
  const initializeAudioContext = useGlobalStore((state) => state.initializeAudioContext);

  const audioContextState = audioPlayer?.audioContext?.state;
  const isAudioReady = audioContextState === 'running';
  
  const handleEnableAudio = async () => {
    try {
      if (!audioPlayer?.audioContext) {
        await initializeAudioContext();
      } else if (audioContextState === 'suspended') {
        await useGlobalStore.getState().resumeAudioContext();
      }
    } catch (error) {
      // Error handling without console logging
    }
  };

  // Don't show if audio sources aren't loaded yet
  if (!audioSourcesLoaded) {
    return null;
  }

  // Don't show if audio is already working
  if (isAudioReady) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-4 right-4 z-50"
    >
      <motion.button
        onClick={handleEnableAudio}
        disabled={isInitingAudioContext}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm
          ${isInitingAudioContext 
            ? 'bg-yellow-600/80 text-yellow-100 cursor-not-allowed' 
            : 'bg-red-600/90 hover:bg-red-600 text-white cursor-pointer'
          }
          backdrop-blur-sm transition-all duration-200
        `}
        whileHover={isInitingAudioContext ? {} : { scale: 1.05 }}
        whileTap={isInitingAudioContext ? {} : { scale: 0.95 }}
      >
        <motion.div
          animate={isInitingAudioContext ? { rotate: 360 } : {}}
          transition={{ duration: 1, repeat: isInitingAudioContext ? Infinity : 0, ease: "linear" }}
        >
          {isInitingAudioContext ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </motion.div>
        <span>
          {isInitingAudioContext ? 'Starting Audio...' : 'Enable Audio'}
        </span>
      </motion.button>
    </motion.div>
  );
}
