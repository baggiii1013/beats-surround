'use client';

import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Play, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGlobalStore } from '../store/global';

export default function LoadingScreen() {
  const [showError, setShowError] = useState(false);
  const [showUserInteractionPrompt, setShowUserInteractionPrompt] = useState(false);
  
  const isInitingSystem = useGlobalStore((state) => state.isInitingSystem);
  const audioSources = useGlobalStore((state) => state.audioSources);
  const hasUserStartedSystem = useGlobalStore((state) => state.hasUserStartedSystem);
  const initializeAudio = useGlobalStore((state) => state.initializeAudio);
  const resumeAudioContext = useGlobalStore((state) => state.resumeAudioContext);

  // Show user interaction prompt if we need user gesture for audio
  useEffect(() => {
    if (!hasUserStartedSystem && !isInitingSystem && audioSources.length === 0) {
      const timer = setTimeout(() => {
        setShowUserInteractionPrompt(true);
      }, 1000); // Show prompt after 1 second if no interaction
      
      return () => clearTimeout(timer);
    }
  }, [hasUserStartedSystem, isInitingSystem, audioSources.length]);

  // Show error if initialization takes too long
  useEffect(() => {
    if (isInitingSystem) {
      const timeout = setTimeout(() => {
        if (isInitingSystem && audioSources.length === 0) {
          setShowError(true);
        }
      }, 20000); // 20 second timeout for large files

      return () => clearTimeout(timeout);
    }
  }, [isInitingSystem, audioSources.length]);

  // Reset states when audio loads successfully  
  useEffect(() => {
    if (audioSources.length > 0 && !isInitingSystem) {
      setShowError(false);
      setShowUserInteractionPrompt(false);
    }
  }, [audioSources.length, isInitingSystem]);

  const handleStartAudio = async () => {
    try {
      setShowUserInteractionPrompt(false);
      
      // Mark that user has started the system
      useGlobalStore.setState({ 
        hasUserStartedSystem: true,
        isInitingSystem: true 
      });
      
      // Try to resume existing context first
      const resumed = await resumeAudioContext();
      
      if (!resumed && audioSources.length === 0) {
        // If no existing context or sources, initialize fresh
        await initializeAudio();
      }
      
    } catch (error) {
      console.error('Failed to start audio:', error);
      setShowError(true);
    }
  };

  const handleRetry = () => {
    setShowError(false);
    useGlobalStore.setState({ isInitingSystem: true });
    initializeAudio().catch(() => {
      setShowError(true);
    });
  };

  const handleSkip = () => {
    useGlobalStore.setState({ 
      isInitingSystem: false,
      hasUserStartedSystem: true 
    });
  };

  // Don't show loading screen if user hasn't started the system yet
  if (!hasUserStartedSystem && !isInitingSystem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-8 max-w-md mx-4"
        >
          {showUserInteractionPrompt ? (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <Play className="w-8 h-8 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Start Your Audio Experience
              </h2>
              <p className="text-gray-300 mb-6">
                Click below to initialize the audio system and begin enjoying synchronized music playback.
              </p>
              <motion.button
                onClick={handleStartAudio}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Audio System
              </motion.button>
            </>
          ) : (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-gray-300">Preparing audio system...</p>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // Show loading screen during initialization
  if (isInitingSystem && audioSources.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-8"
        >
          {showError ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="max-w-md mx-4"
            >
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-white mb-4">
                Audio Loading Failed
              </h2>
              <p className="text-gray-300 mb-6">
                We couldn&apos;t load the audio files. This might be due to network issues or browser restrictions.
              </p>
              <div className="flex gap-4 justify-center">
                <motion.button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Retry
                </motion.button>
                <motion.button
                  onClick={handleSkip}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Continue Anyway
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6"
              />
              <h2 className="text-2xl font-bold text-white mb-4">
                Loading Audio System
              </h2>
              <p className="text-gray-300 mb-4">
                Downloading and preparing audio files...
              </p>
              <motion.div
                className="w-64 h-2 bg-gray-700 rounded-full mx-auto overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="h-full bg-blue-600 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 15, ease: "easeInOut" }}
                />
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // Don't render anything if audio is loaded
  return null;
}
