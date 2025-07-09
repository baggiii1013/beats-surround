'use client';

import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGlobalStore } from '../store/global';

export default function LoadingScreen() {
  const [showError, setShowError] = useState(false);
  const isInitingSystem = useGlobalStore((state) => state.isInitingSystem);
  const audioSources = useGlobalStore((state) => state.audioSources);
  const initializeAudio = useGlobalStore((state) => state.initializeAudio);

  useEffect(() => {
    // Show error if initialization takes too long AND we still have no audio sources
    const timeout = setTimeout(() => {
      if (isInitingSystem && audioSources.length === 0) {
        setShowError(true);
      }
    }, 8000); // Increased timeout to 8 seconds

    return () => clearTimeout(timeout);
  }, [isInitingSystem, audioSources.length]);

  // Reset error state if audio sources are loaded
  useEffect(() => {
    if (audioSources.length > 0) {
      setShowError(false);
    }
  }, [audioSources.length]);

  const handleRetry = () => {
    setShowError(false);
    initializeAudio();
  };

  const handleSkip = () => {
    setShowError(false);
    // Force complete initialization even without audio
    useGlobalStore.setState({ isInitingSystem: false, audioSources: [] });
  };

  const handleForceSkip = () => {
    console.log('Force skipping initialization');
    useGlobalStore.setState({ isInitingSystem: false, audioSources: [] });
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md mx-auto px-6"
      >
        <motion.div
          animate={{ rotate: showError ? 0 : 360 }}
          transition={{ duration: 2, repeat: showError ? 0 : Infinity, ease: "linear" }}
          className={`w-16 h-16 ${showError ? 'bg-red-500' : 'bg-gradient-to-br from-blue-500 to-purple-600'} rounded-full flex items-center justify-center mx-auto mb-4`}
        >
          {showError ? (
            <AlertCircle className="w-8 h-8 text-white" />
          ) : (
            <Volume2 className="w-8 h-8 text-white" />
          )}
        </motion.div>
        
        <h2 className="text-xl font-bold text-white mb-2">BeatsSurround</h2>
        
        {showError ? (
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
            <p className="text-gray-400 text-sm mb-4">Initializing audio system...</p>
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-blue-400 text-sm">Loading</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
