'use client';

import { useEffect, useRef, useState } from 'react';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';

export default function AudioInitializer() {
  const loadAudioSources = useGlobalStore((state) => state.loadAudioSources);
  const audioSources = useGlobalStore((state) => state.audioSources);
  const audioSourcesLoaded = useGlobalStore((state) => state.audioSourcesLoaded);
  const isLoadingSources = useGlobalStore((state) => state.isLoadingSources);
  const roomId = useRoomStore((state) => state.roomId);
  
  const [mounted, setMounted] = useState(false);
  const loadingAttempted = useRef(false);
  const lastRoomId = useRef(null);

  // Ensure we're on the client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load audio sources when component mounts or room changes
  useEffect(() => {
    if (!mounted) return;
    
    // Load sources if:
    // 1. We haven't loaded them yet and aren't currently loading
    // 2. Room changed and we need fresh sources (but only if sources aren't already loaded)
    const shouldLoadSources = (
      (!audioSourcesLoaded && !isLoadingSources && !loadingAttempted.current) ||
      (roomId && roomId !== lastRoomId.current && !isLoadingSources && !audioSourcesLoaded)
    );
    
    if (shouldLoadSources) {
      loadingAttempted.current = true;
      lastRoomId.current = roomId;
      
      // Load sources with a small delay to prevent race conditions
      const timeoutId = setTimeout(async () => {
        try {
          await loadAudioSources();
        } catch (error) {
          console.error('Failed to load audio sources:', error);
          loadingAttempted.current = false; // Allow retry
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [mounted, audioSourcesLoaded, isLoadingSources, roomId, loadAudioSources]);

  // Reset loading state when room changes
  useEffect(() => {
    if (roomId !== lastRoomId.current) {
      loadingAttempted.current = false;
    }
  }, [roomId]);

  return null; // This component doesn't render anything
}
