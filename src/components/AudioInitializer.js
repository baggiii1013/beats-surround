'use client';

import { useEffect, useState } from 'react';
import { useGlobalStore } from '../store/global';

export default function AudioInitializer() {
  const initializeAudio = useGlobalStore((state) => state.initializeAudio);
  const isInitingSystem = useGlobalStore((state) => state.isInitingSystem);
  const audioSources = useGlobalStore((state) => state.audioSources);
  const [mounted, setMounted] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return; // Don't run on server side
    
    // Only initialize if we're still in the init state and have no audio sources
    if (isInitingSystem && audioSources.length === 0) {
      
      // Use a very short timeout to ensure the component is fully mounted
      const timeoutId = setTimeout(() => {
        initializeAudio().catch(error => {
          // Audio initialization failed
        });
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [mounted, isInitingSystem, audioSources.length, initializeAudio]);

  return null; // This component doesn't render anything
}
