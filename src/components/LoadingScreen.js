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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--background-secondary))] to-[hsl(var(--background-tertiary))] relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center p-8 max-w-md mx-4 glass-strong rounded-2xl shadow-2xl relative z-10"
        >
          {showUserInteractionPrompt ? (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-20 h-20 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl animate-pulse-glow"
              >
                <Play className="w-10 h-10 text-white" />
              </motion.div>
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold bg-gradient-to-r from-white via-accent to-primary bg-clip-text text-transparent mb-4"
              >
                Ready to Start Audio?
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground mb-6 leading-relaxed"
              >
                BeatsSurround needs your permission to start the audio system. Click below to begin your synchronized music experience.
              </motion.p>
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStartAudio}
                className="bg-gradient-primary text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center mx-auto"
              >
                <Play className="w-5 h-5 mr-3" />
                Start Audio System
              </motion.button>
            </>
          ) : (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-secondary/30"
              >
                <Volume2 className="w-8 h-8 text-secondary" />
              </motion.div>
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-white mb-4"
              >
                Welcome to BeatsSurround
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground mb-6 leading-relaxed"
              >
                Click below to initialize the audio system and begin enjoying synchronized music playback.
              </motion.p>
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                onClick={handleStartAudio}
                className="bg-gradient-primary text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center mx-auto"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Play className="w-5 h-5 mr-3" />
                Start Audio System
              </motion.button>
            </>
          )} : (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-muted-foreground">Preparing audio system...</p>
            </>
          )
        </motion.div>
      </div>
    );
  }

  // Show loading screen during initialization
  if (isInitingSystem && audioSources.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--background-secondary))] to-[hsl(var(--background-tertiary))] relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center p-8 glass-strong rounded-2xl shadow-2xl relative z-10 max-w-md mx-4"
        >
          {showError ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-20 h-20 bg-destructive/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-destructive/30"
              >
                <AlertCircle className="w-10 h-10 text-destructive" />
              </motion.div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-destructive bg-clip-text text-transparent mb-4">
                Audio Loading Failed
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                We couldn&apos;t load the audio files. This might be due to network issues or browser restrictions.
              </p>
              <div className="flex gap-4 justify-center">
                <motion.button
                  onClick={handleRetry}
                  className="bg-gradient-primary text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Retry
                </motion.button>
                <motion.button
                  onClick={handleSkip}
                  className="glass text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 border border-border hover:border-primary/50"
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
                className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6"
              />
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-accent to-primary bg-clip-text text-transparent mb-4">
                Loading Audio System
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Downloading and preparing audio files...
              </p>
              <motion.div
                className="w-64 h-3 glass rounded-full mx-auto overflow-hidden border border-border"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="h-full bg-gradient-primary rounded-full"
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
