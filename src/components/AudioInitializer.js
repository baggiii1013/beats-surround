'use client';

import { motion } from 'framer-motion';
import { Loader2, Play, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';

/**
 * AudioInitializer - Inspired by BeatSync's approach
 * 
 * This component handles audio initialization in a user-friendly way that respects
 * browser autoplay policies and provides a smooth user experience.
 * 
 * Key Features:
 * 1. Never auto-initializes AudioContext without user interaction
 * 2. Shows clear UI for users to enable audio
 * 3. Handles AudioContext suspension/resumption properly
 * 4. Prevents concurrent initialization attempts
 * 5. Provides loading feedback and error handling
 */
export default function AudioInitializer() {
  // Global store state
  const audioSources = useGlobalStore((state) => state.audioSources);
  const audioSourcesLoaded = useGlobalStore((state) => state.audioSourcesLoaded);
  const isLoadingSources = useGlobalStore((state) => state.isLoadingSources);
  const hasUserInteracted = useGlobalStore((state) => state.hasUserInteracted);
  const isInitingAudioContext = useGlobalStore((state) => state.isInitingAudioContext);
  const audioPlayer = useGlobalStore((state) => state.audioPlayer);
  
  // Global store actions
  const loadAudioSources = useGlobalStore((state) => state.loadAudioSources);
  const initializeAudioContext = useGlobalStore((state) => state.initializeAudioContext);
  const resumeAudioContext = useGlobalStore((state) => state.resumeAudioContext);
  
  // Room store state
  const roomId = useRoomStore((state) => state.roomId);
  
  // Local state
  const [mounted, setMounted] = useState(false);
  const [showStartButton, setShowStartButton] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs to prevent duplicate operations
  const sourcesLoadingRef = useRef(false);
  const lastRoomIdRef = useRef(null);
  
  // Ensure we're on the client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Phase 1: Load audio sources (can happen without user interaction)
  useEffect(() => {
    if (!mounted) return;
    
    // Load sources if:
    // 1. We haven't loaded them yet and aren't currently loading
    // 2. Room changed and we need fresh sources
    const shouldLoadSources = (
      (!audioSourcesLoaded && !isLoadingSources && !sourcesLoadingRef.current) ||
      (roomId && roomId !== lastRoomIdRef.current && !isLoadingSources)
    );
    
    if (shouldLoadSources) {
      sourcesLoadingRef.current = true;
      lastRoomIdRef.current = roomId;
      
      // Small delay to prevent race conditions
      const timeoutId = setTimeout(async () => {
        try {
          await loadAudioSources();
        } catch (error) {
          setError('Failed to load audio files');
        } finally {
          sourcesLoadingRef.current = false;
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [mounted, audioSourcesLoaded, isLoadingSources, roomId, loadAudioSources]);

  // Reset loading state when room changes
  useEffect(() => {
    if (roomId !== lastRoomIdRef.current) {
      sourcesLoadingRef.current = false;
      setError(null);
    }
  }, [roomId]);

  // Phase 2: Determine if we need to show the start button
  useEffect(() => {
    if (!mounted) return;
    
    // Show start button if:
    // 1. Audio sources are loaded
    // 2. User hasn't interacted yet OR AudioContext is suspended
    // 3. We're not currently initializing
    
    const needsUserInteraction = !hasUserInteracted || 
      (audioPlayer?.audioContext?.state === 'suspended');
    
    const shouldShowButton = audioSourcesLoaded && 
      needsUserInteraction && 
      !isInitingAudioContext;
    
    setShowStartButton(shouldShowButton);
    
    // Auto-hide error after some time if sources load successfully
    if (audioSourcesLoaded && error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [
    mounted, 
    audioSourcesLoaded, 
    hasUserInteracted, 
    audioPlayer?.audioContext?.state,
    isInitingAudioContext,
    error
  ]);

  // Handle start button click
  const handleStartAudio = async () => {
    if (isStarting || isInitingAudioContext) return;
    
    setIsStarting(true);
    setError(null);
    
    try {
      // If we already have an AudioContext, try to resume it first
      if (audioPlayer?.audioContext) {
        const resumed = await resumeAudioContext();
        
        if (resumed) {
          setShowStartButton(false);
          return;
        }
      }
      
      // Initialize new AudioContext
      const success = await initializeAudioContext();
      
      if (success) {
        setShowStartButton(false);
      } else {
        throw new Error('Failed to initialize audio context');
      }
      
    } catch (error) {
      setError(error.message || 'Failed to start audio system');
    } finally {
      setIsStarting(false);
    }
  };

  // Don't render anything during SSR
  if (!mounted) {
    return null;
  }

  // Show loading state while sources are loading
  if (isLoadingSources && !audioSourcesLoaded) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-900 border border-gray-700 rounded-lg p-6 flex items-center gap-4 max-w-sm mx-4"
        >
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <div>
            <h3 className="text-white font-medium">Loading Audio</h3>
            <p className="text-gray-400 text-sm">Preparing music files...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show error state if loading failed
  if (error && !isLoadingSources && !audioSourcesLoaded) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-900/20 border border-red-700/50 rounded-lg p-6 max-w-sm mx-4"
        >
          <div className="text-center">
            <h3 className="text-red-400 font-medium mb-2">Audio Loading Failed</h3>
            <p className="text-gray-400 text-sm mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                loadAudioSources();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show start button when user interaction is needed
  if (showStartButton) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center max-w-md mx-4"
        >
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Volume2 className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Enable Audio
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Click the button below to initialize the audio system and start enjoying synchronized music.
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded-md"
            >
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}

          <motion.button
            onClick={handleStartAudio}
            disabled={isStarting || isInitingAudioContext}
            className={`
              w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 
              text-white font-medium rounded-lg transition-all duration-200 
              flex items-center justify-center gap-3
              ${(isStarting || isInitingAudioContext) ? 'cursor-not-allowed' : 'hover:scale-105'}
            `}
            whileHover={(isStarting || isInitingAudioContext) ? {} : { scale: 1.02 }}
            whileTap={(isStarting || isInitingAudioContext) ? {} : { scale: 0.98 }}
          >
            {isStarting || isInitingAudioContext ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Starting Audio...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>Start Audio System</span>
              </>
            )}
          </motion.button>

          <p className="text-gray-500 text-xs mt-4">
            This enables browser audio permissions and initializes the audio engine.
          </p>
        </motion.div>
      </div>
    );
  }

  // Component successfully initialized - render nothing (invisible component)
  return null;
}
