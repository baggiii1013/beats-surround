'use client';

import { useEffect, useState } from 'react';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';

export default function AudioInitializer() {
  const initializeAudio = useGlobalStore((state) => state.initializeAudio);
  const resumeAudioContext = useGlobalStore((state) => state.resumeAudioContext);
  const isInitingSystem = useGlobalStore((state) => state.isInitingSystem);
  const audioSources = useGlobalStore((state) => state.audioSources);
  const audioPlayer = useGlobalStore((state) => state.audioPlayer);
  const roomId = useRoomStore((state) => state.roomId);
  const [mounted, setMounted] = useState(false);
  const [userInteractionDetected, setUserInteractionDetected] = useState(false);
  const [hasInitializedForRoom, setHasInitializedForRoom] = useState(null);

  // Ensure we're on the client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Safari compatibility: detect user interaction to unlock audio
  useEffect(() => {
    if (!mounted || userInteractionDetected) return;

    const handleUserInteraction = async () => {
      setUserInteractionDetected(true);
      
      // Try to resume audio context if it exists and is suspended
      if (audioPlayer?.audioContext?.state === 'suspended') {
        await resumeAudioContext();
      }
    };

    // Listen for various user interaction events
    const events = ['click', 'touchstart', 'keydown', 'pointerdown'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [mounted, userInteractionDetected, audioPlayer, resumeAudioContext]);

  useEffect(() => {
    if (!mounted) return; // Don't run on server side
    
    // Initialize audio when:
    // 1. System is in init state and has no audio sources (first time)
    // 2. User just joined/created a room and has no audio sources
    const shouldInitialize = (
      (isInitingSystem && audioSources.length === 0) ||
      (roomId && roomId !== hasInitializedForRoom && audioSources.length === 0 && !isInitingSystem)
    );
    
    if (shouldInitialize) {
      // Mark that we're initializing for this room
      setHasInitializedForRoom(roomId);
      
      // Set init state if not already set
      if (!isInitingSystem) {
        useGlobalStore.setState({ isInitingSystem: true });
      }
      
      // Detect Safari/iOS
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // Use appropriate timeout for Safari/iOS vs other browsers
      const delay = (isSafari || isIOS) ? 200 : 50;
      
      const timeoutId = setTimeout(() => {
        initializeAudio().catch(error => {
          // Set a fallback state to prevent infinite loading
          useGlobalStore.setState({ isInitingSystem: false });
        });
      }, delay);

      return () => clearTimeout(timeoutId);
    }
  }, [mounted, isInitingSystem, audioSources.length, roomId, hasInitializedForRoom, initializeAudio]);

  return null; // This component doesn't render anything
}
