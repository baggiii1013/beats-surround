/**
 * Mobile Audio Optimization Module
 * 
 * Handles mobile-specific audio optimizations, particularly for Safari/iOS
 * to prevent audio stopping when the phone locks or goes to background.
 */

// Enhanced Media Session API setup for mobile Safari
export const setupMobileMediaSession = (audioSources = [], currentTrack = null) => {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) {
    return;
  }

  try {
    // Set metadata for current track
    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.name || 'Unknown Track',
        artist: currentTrack.artist || 'Unknown Artist',
        album: currentTrack.album || 'BeatsSync',
        artwork: currentTrack.coverArt ? [
          {
            src: currentTrack.coverArt,
            sizes: '512x512',
            type: 'image/png'
          }
        ] : []
      });
    } else {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'BeatsSync Audio Player',
        artist: 'BeatsSync',
        album: 'Synchronized Audio'
      });
    }

    // Set playback state
    navigator.mediaSession.playbackState = 'playing';
    
  } catch (error) {
    // Failed to set up Media Session API
  }
};

// Update media session playback state
export const updateMediaSessionState = (isPlaying) => {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) {
    return;
  }

  try {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  } catch (error) {
    // Failed to update Media Session state
  }
};

// Set up media session action handlers
export const setupMediaSessionHandlers = (getState) => {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) {
    return;
  }

  try {
    // Play handler
    navigator.mediaSession.setActionHandler('play', async () => {
      const state = getState();
      
      // Resume audio context if suspended
      if (state.audioPlayer?.audioContext?.state === 'suspended') {
        try {
          await state.audioPlayer.audioContext.resume();
        } catch (e) {
          // Failed to resume audio context from media session
        }
      }
      
      // Trigger play if not already playing
      if (!state.isPlaying) {
        state.broadcastPlay();
      }
    });

    // Pause handler
    navigator.mediaSession.setActionHandler('pause', () => {
      const state = getState();
      if (state.isPlaying) {
        state.broadcastPause();
      }
    });

    // Previous track handler
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const state = getState();
      if (state.skipToPreviousTrack) {
        state.skipToPreviousTrack();
      }
    });

    // Next track handler
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      const state = getState();
      if (state.skipToNextTrack) {
        state.skipToNextTrack();
      }
    });

    // Seek backward handler
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const state = getState();
      const seekTime = details.seekOffset || 10;
      const currentPosition = state.getCurrentTrackPosition?.() || 0;
      const newPosition = Math.max(0, currentPosition - seekTime);
      
      if (state.broadcastPlay) {
        state.broadcastPlay(newPosition);
      }
    });

    // Seek forward handler
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const state = getState();
      const seekTime = details.seekOffset || 10;
      const currentPosition = state.getCurrentTrackPosition?.() || 0;
      const duration = state.duration || 0;
      const newPosition = Math.min(duration, currentPosition + seekTime);
      
      if (state.broadcastPlay) {
        state.broadcastPlay(newPosition);
      }
    });

    // Seek to handler
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      const state = getState();
      const seekTime = details.seekTime || 0;
      
      if (state.broadcastPlay) {
        state.broadcastPlay(seekTime);
      }
    });

  } catch (error) {
    // Failed to set up Media Session handlers
  }
};

// Request wake lock to prevent screen from affecting audio
export const requestWakeLock = async () => {
  if (typeof navigator === 'undefined' || !navigator.wakeLock) {
    return null;
  }

  try {
    const wakeLock = await navigator.wakeLock.request('screen');
    
    // Handle wake lock release
    wakeLock.addEventListener('release', () => {
      // Wake lock was released
    });
    
    return wakeLock;
  } catch (error) {
    // Failed to request wake lock
    return null;
  }
};

// Mobile Safari audio session optimization
export const optimizeForMobileSafari = () => {
  if (typeof navigator === 'undefined') {
    return;
  }

  // Set iOS audio session type if available
  if (navigator.audioSession) {
    try {
      navigator.audioSession.type = 'playback';
    } catch (e) {
      // Not available or not supported
    }
  }

  // Prevent iOS from pausing audio on lock screen
  if ('serviceWorker' in navigator) {
    // Register a minimal service worker to maintain background context
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker not available, continue without it
    });
  }
};

// Monitor and recover from audio suspension
export const createAudioSuspensionMonitor = (getState) => {
  if (typeof window === 'undefined' || typeof getState !== 'function') {
    return null;
  }

  let recoveryAttempts = 0;
  const maxRecoveryAttempts = 3;
  
  const monitor = setInterval(async () => {
    try {
      const state = getState();
      
      // Defensive check to ensure state exists
      if (!state || typeof state !== 'object') {
        // Invalid state in audio suspension monitor
        return;
      }
      
      const audioContext = state.audioPlayer?.audioContext;
      
      if (!audioContext) return;
      
      // Check if context is suspended while we expect it to be playing
      if (state.isPlaying && audioContext.state === 'suspended') {
        // Audio context suspended during playback, attempting recovery
        
        if (recoveryAttempts < maxRecoveryAttempts) {
          try {
            await audioContext.resume();
            recoveryAttempts = 0; // Reset on successful recovery
            // Audio context successfully resumed
          } catch (error) {
            recoveryAttempts++;
            // Audio context recovery attempt failed
            
            if (recoveryAttempts >= maxRecoveryAttempts) {
              // Max recovery attempts reached, giving up
            }
          }
        }
      } else {
        // Reset recovery attempts when context is healthy
        recoveryAttempts = 0;
      }
    } catch (error) {
      // Audio suspension monitor error
      // Don't clear the interval on error, just continue monitoring
    }
  }, 1000); // Check every second
  
  return monitor;
};

// Comprehensive mobile audio initialization
export const initializeMobileAudio = async (getState) => {
  // Optimize for mobile Safari
  optimizeForMobileSafari();
  
  // Set up Media Session API if getState is provided
  if (getState) {
    setupMediaSessionHandlers(getState);
    
    // Start audio suspension monitoring
    const monitor = createAudioSuspensionMonitor(getState);
    
    // Request wake lock for better background performance
    try {
      await requestWakeLock();
    } catch (wakeError) {
      // Wake lock failed
    }
    
    // Register service worker for enhanced background support
    try {
      await registerServiceWorker();
    } catch (swError) {
      // Service worker registration failed
    }
    
    return {
      cleanup: () => {
        if (monitor) {
          clearInterval(monitor);
        }
      }
    };
  } else {
    // Basic initialization without store integration
    try {
      await requestWakeLock();
    } catch (wakeError) {
      // Wake lock failed
    }
    
    try {
      await registerServiceWorker();
    } catch (swError) {
      // Service worker registration failed
    }
    
    return {
      cleanup: () => {}
    };
  }
};

// Register and manage service worker for background audio support
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    // Service workers not supported
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Service Worker registered successfully

    // Send ping to service worker periodically to keep it active
    const keepAlive = () => {
      if (registration.active) {
        registration.active.postMessage({ type: 'PING' });
      }
    };

    // Ping every 25 seconds to keep service worker active during audio playback
    setInterval(keepAlive, 25000);

    return registration;
  } catch (error) {
    // Service Worker registration failed
    return null;
  }
};

// Notify service worker of audio state changes
export const notifyServiceWorkerAudioState = (isPlaying) => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: isPlaying ? 'AUDIO_PLAYING' : 'AUDIO_PAUSED',
      data: { timestamp: Date.now() }
    });
  }
};
