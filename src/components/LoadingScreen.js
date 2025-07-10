'use client';

import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGlobalStore } from '../store/global';

export default function LoadingScreen() {
  const [showError, setShowError] = useState(false);
  const [showAutoplayWarning, setShowAutoplayWarning] = useState(false);
  const isInitingSystem = useGlobalStore((state) => state.isInitingSystem);
  const audioSources = useGlobalStore((state) => state.audioSources);
  const initializeAudio = useGlobalStore((state) => state.initializeAudio);
  const resumeAudioContext = useGlobalStore((state) => state.resumeAudioContext);

  useEffect(() => {
    // Show autoplay warning if we have suspended audio
    if (audioSources.length > 0) {
      const hasSuspendedAudio = audioSources.some(source => source.requiresUserInteraction);
      if (hasSuspendedAudio) {
        setShowAutoplayWarning(true);
        return;
      }
    }

    // Show error if initialization takes too long AND we still have no audio sources
    const timeout = setTimeout(() => {
      if (isInitingSystem && audioSources.length === 0) {
        setShowError(true);
      }
    }, 15000); // Increased timeout to 15 seconds for loading FLAC files

    return () => clearTimeout(timeout);
  }, [isInitingSystem, audioSources]);

  // Reset error state if audio sources are loaded
  useEffect(() => {
    if (audioSources.length > 0 && !audioSources.some(source => source.requiresUserInteraction)) {
      setShowError(false);
      setShowAutoplayWarning(false);
    }
  }, [audioSources]);

  const handleRetry = () => {
    setShowError(false);
    initializeAudio();
  };

  const handleSkip = () => {
    setShowError(false);
    setShowAutoplayWarning(false);
    // Force complete initialization even without audio
    useGlobalStore.setState({ isInitingSystem: false, audioSources: [] });
  };

  const handleEnableAudio = async () => {
    setShowAutoplayWarning(false);
    await resumeAudioContext();
    // The resumeAudioContext method will handle updating the store state
  };

  const handleForceSkip = () => {
    useGlobalStore.setState({ isInitingSystem: false, audioSources: [] });
  };

  // Auto-redirect to main page after showing autoplay warning
  useEffect(() => {
    if (showAutoplayWarning) {
      const autoRedirectTimeout = setTimeout(() => {
        // Automatically proceed to main page without enabling audio
        setShowAutoplayWarning(false);
        useGlobalStore.setState({ isInitingSystem: false });
      }, 3000); // Show warning for 3 seconds before auto-redirecting

      return () => clearTimeout(autoRedirectTimeout);
    }
  }, [showAutoplayWarning]);

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md mx-auto px-6"
      >
        <motion.div
          animate={{ rotate: (showError || showAutoplayWarning) ? 0 : 360 }}
          transition={{ duration: 2, repeat: (showError || showAutoplayWarning) ? 0 : Infinity, ease: "linear" }}
          className={`w-16 h-16 ${(showError || showAutoplayWarning) ? 'bg-orange-500' : 'bg-gradient-to-br from-blue-500 to-purple-600'} rounded-full flex items-center justify-center mx-auto mb-4`}
        >
          {(showError || showAutoplayWarning) ? (
            <AlertCircle className="w-8 h-8 text-white" />
          ) : (
            <Volume2 className="w-8 h-8 text-white" />
          )}
        </motion.div>
        
        <h2 className="text-xl font-bold text-white mb-2">BeatsSurround</h2>
        
        {showAutoplayWarning ? (
          <div>
            <p className="text-orange-400 text-sm mb-4">
              Audio initialization is taking longer than expected due to browser autoplay restrictions.
            </p>
            <p className="text-gray-400 text-xs mb-4">
              You'll be redirected to the main page where you can enable audio playback manually.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
              <span className="text-orange-400 text-sm">
                Redirecting...
              </span>
            </div>
          </div>
        ) : showError ? (
          <div>
            <p className="text-red-400 text-sm mb-4">
              Audio initialization is taking longer than expected. This might be due to browser autoplay restrictions.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
              >
                Retry
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm transition-colors"
              >
                Skip Audio
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-gray-400 text-sm mb-4">
              {audioSources.length > 0 
                ? 'Finalizing audio setup...' 
                : 'Loading demo audio files...'
              }
            </p>
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-blue-400 text-sm">
                {audioSources.length > 0 ? 'Almost ready' : 'Loading'}
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
