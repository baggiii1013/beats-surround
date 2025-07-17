'use client';

import { motion } from 'framer-motion';
import { Play, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { useGlobalStore } from '../store/global';

export default function AudioStartButton({ 
  children, 
  className = "",
  variant = "default",
  ...props 
}) {
  const [isStarting, setIsStarting] = useState(false);
  const hasUserInteracted = useGlobalStore((state) => state.hasUserInteracted);
  const isInitingAudioContext = useGlobalStore((state) => state.isInitingAudioContext);
  const audioPlayer = useGlobalStore((state) => state.audioPlayer);
  const initializeAudioContext = useGlobalStore((state) => state.initializeAudioContext);

  // Don't show button if audio context is already initialized and running
  const audioContextState = audioPlayer?.audioContext?.state;
  if (audioContextState === 'running') {
    return null;
  }

  const handleStartAudio = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isStarting || isInitingAudioContext) return;
    
    setIsStarting(true);
    
    try {
      await initializeAudioContext();
    } catch (error) {
      // Error handling without console logging
    } finally {
      setIsStarting(false);
    }
  };

  const baseClasses = "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900";
  
  const variants = {
    default: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg",
    minimal: "px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white text-sm rounded",
    icon: "p-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-full",
    ghost: "px-3 py-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-600/10 rounded"
  };

  const Icon = variant === 'icon' ? Play : Volume2;
  const iconSize = variant === 'icon' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <motion.button
      onClick={handleStartAudio}
      disabled={isStarting || isInitingSystem}
      className={`${baseClasses} ${variants[variant]} ${className} ${
        (isStarting || isInitingAudioContext) ? 'opacity-60 cursor-not-allowed' : ''
      }`}
      whileHover={{ scale: (isStarting || isInitingAudioContext) ? 1 : 1.05 }}
      whileTap={{ scale: (isStarting || isInitingAudioContext) ? 1 : 0.95 }}
      {...props}
    >
      <motion.div
        animate={isStarting ? { rotate: 360 } : {}}
        transition={{ duration: 1, repeat: isStarting ? Infinity : 0, ease: "linear" }}
      >
        <Icon className={iconSize} />
      </motion.div>
      {variant !== 'icon' && (
        <span>
          {isStarting ? 'Starting...' : 
           isInitingAudioContext ? 'Loading...' : 
           children || 'Enable Audio'}
        </span>
      )}
    </motion.button>
  );
}
