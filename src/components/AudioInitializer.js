'use client';

import { useEffect } from 'react';
import { useGlobalStore } from '../store/global';

export default function AudioInitializer() {
  const initializeAudio = useGlobalStore((state) => state.initializeAudio);
  const isInitingSystem = useGlobalStore((state) => state.isInitingSystem);
  const audioSources = useGlobalStore((state) => state.audioSources);

  useEffect(() => {
    // Initialize audio system on client side if not already initialized
    if (isInitingSystem && audioSources.length === 0) {
      initializeAudio();
    }
  }, [initializeAudio, isInitingSystem, audioSources.length]);

  return null; // This component doesn't render anything
}
