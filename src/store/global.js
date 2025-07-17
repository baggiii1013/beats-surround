import { toast } from 'sonner';
import { create } from 'zustand';
import { createPlaceholderCoverArt, extractAudioMetadata } from '../lib/audioMetadata';
import { createHighPrecisionTimer, getAudioController, getSyncEngine } from '../lib/audioSync';
import { initializeMobileAudio, notifyServiceWorkerAudioState } from '../lib/mobileAudio';
import { fetchDefaultAudioFiles } from '../lib/r2-api';
import simpleCacheModule, { cacheAudio, getAllCachedAudio, getCachedAudio, isCached } from '../lib/simpleAudioCache';

const MAX_NTP_MEASUREMENTS = 40;

// Audio player state interface
const AudioPlayerError = {
  NotInitialized: "NOT_INITIALIZED",
};

const GRID = {
  ORIGIN_X: 50,
  ORIGIN_Y: 50,
};

const initialState = {
  // Audio playback state
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isShuffled: false,
  
  // Audio sources and selection
  audioSources: [],
  selectedAudioId: null,
  audioSourcesLoaded: false, // Track if sources are loaded separately from context
  
  // System state - Separate loading from audio context initialization
  isLoadingSources: false,
  isInitingAudioContext: false,
  hasUserInteracted: false,
  audioPlayer: null,
  
  // Network and sync - Enhanced for WebSocket
  socket: null,
  offsetEstimate: 0,
  ntpMeasurements: [],
  roundTripEstimate: 0,
  isSynced: false,
  
  // Sync quality monitoring
  syncQuality: {
    latency: 0,
    jitter: 0,
    accuracy: 0,
    clockDrift: 0,
    qualityLevel: 'unknown', // 'excellent', 'good', 'fair', 'poor', 'unknown'
    lastUpdate: 0
  },
  
  // Connection status monitoring
  connectionStatus: {
    isConnected: false,
    connectionStrength: 'unknown', // 'excellent', 'good', 'fair', 'poor', 'unknown'
    ping: 0,
    packetLoss: 0,
    reconnectCount: 0,
    lastReconnectTime: 0,
    uptime: 0,
    connectionStartTime: 0,
    bytesReceived: 0,
    bytesSent: 0,
    messagesReceived: 0,
    messagesSent: 0,
    lastPingTime: 0
  },
  
  // Room and users
  connectedClients: [],
  
  // Upload tracking
  uploadHistory: [],
  downloadedAudioIds: new Set(),
  
  // Spatial audio
  spatialConfig: null,
  listeningSourcePosition: { x: GRID.ORIGIN_X, y: GRID.ORIGIN_Y },
  isSpatialAudioEnabled: false,
  isDraggingListeningSource: false,
  
  // Playback timing
  playbackStartTime: 0,
  playbackOffset: 0,
  
  // Mobile Safari cleanup function
  mobileSafariCleanup: null,
};

const getAudioPlayer = (state) => {
  if (!state.audioPlayer) {
    throw new Error(AudioPlayerError.NotInitialized);
  }
  return state.audioPlayer;
};

const getSocket = (state) => {
  if (!state.socket) {
    throw new Error("Socket not initialized");
  }
  return { socket: state.socket };
};

const getWaitTimeSeconds = (state, targetServerTime) => {
  const { offsetEstimate } = state;
  const waitTimeMilliseconds = calculateWaitTimeMilliseconds(targetServerTime, offsetEstimate);
  return waitTimeMilliseconds / 1000;
};

// Load audio source metadata without decoding (no AudioContext needed)

const loadAudioSourceMetadata = async ({ url, expectedTitle, expectedArtist }) => {
  // Create a unique ID for this URL-based audio source
  const audioId = url;
  
  // Check if audio is already cached
  const cached = await getCachedAudio(audioId);
  let arrayBuffer;
  let metadata;
  
  if (cached) {
    // Use cached audio data
    arrayBuffer = cached.arrayBuffer;
    metadata = cached.metadata || {};
  } else {
    // Fetch from URL
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    arrayBuffer = await response.arrayBuffer();
    
    // Extract metadata (including cover art) before decoding audio
    metadata = await extractAudioMetadata(arrayBuffer, url);
  }
  
  // Use expected values as fallback if metadata is missing or unclear
  const finalTitle = metadata.title || expectedTitle || extractDefaultFileName(url);
  const finalArtist = metadata.artist || expectedArtist || 'Unknown Artist';
  
  const audioSource = {
    name: finalTitle,
    artist: finalArtist,
    album: metadata.album,
    albumArtist: metadata.albumArtist,
    year: metadata.year,
    genre: metadata.genre,
    coverArt: metadata.coverArt || createPlaceholderCoverArt(finalTitle, finalArtist),
    estimatedDuration: metadata.duration, // Store estimated duration from metadata
    rawAudioBuffer: arrayBuffer, // Store raw buffer for later decoding
    audioBuffer: null, // Will be decoded when AudioContext is available
    id: audioId,
    url: url,
    type: 'url-loaded',
    metadata: metadata,
    needsDecoding: true // Flag to indicate this needs decoding
  };
  
  // Cache the audio if not already cached
  if (!cached) {
    const cacheMetadata = {
      name: finalTitle,
      artist: finalArtist,
      album: metadata.album,
      albumArtist: metadata.albumArtist,
      year: metadata.year,
      genre: metadata.genre,
      duration: metadata.duration,
      coverArt: audioSource.coverArt,
      url: url,
      type: 'url-loaded'
    };
    
    // Cache asynchronously
    cacheAudio(audioId, arrayBuffer, cacheMetadata).catch(() => {});
  }
  
  return audioSource;
};

const loadAudioSourceUrl = async ({ url, audioContext, expectedTitle, expectedArtist }) => {
  // Create a unique ID for this URL-based audio source
  const audioId = url;
  
  // Check if audio is already cached
  const cached = await getCachedAudio(audioId);
  let arrayBuffer;
  let metadata;
  
  if (cached) {
    // Use cached audio data
    arrayBuffer = cached.arrayBuffer;
    metadata = cached.metadata || {};
  } else {
    // Fetch from URL
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    arrayBuffer = await response.arrayBuffer();
    
    // Extract metadata (including cover art) before decoding audio
    metadata = await extractAudioMetadata(arrayBuffer, url);
  }
  
  // Decode audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice());
  
  // Use expected values as fallback if metadata is missing or unclear
  const finalTitle = metadata.title || expectedTitle || extractDefaultFileName(url);
  const finalArtist = metadata.artist || expectedArtist || 'Unknown Artist';
  
  const audioSource = {
    name: finalTitle,
    artist: finalArtist,
    album: metadata.album,
    albumArtist: metadata.albumArtist,
    year: metadata.year,
    genre: metadata.genre,
    coverArt: metadata.coverArt || createPlaceholderCoverArt(finalTitle, finalArtist),
    duration: audioBuffer.duration,
    audioBuffer,
    id: audioId,
    url: url,
    type: 'url-loaded',
    metadata: metadata
  };
  
  // Cache the audio if not already cached
  if (!cached) {
    const cacheMetadata = {
      name: finalTitle,
      artist: finalArtist,
      album: metadata.album,
      albumArtist: metadata.albumArtist,
      year: metadata.year,
      genre: metadata.genre,
      duration: audioBuffer.duration,
      coverArt: audioSource.coverArt,
      url: url,
      type: 'url-loaded'
    };
    
    // Cache asynchronously
    cacheAudio(audioId, arrayBuffer, cacheMetadata).catch(() => {});
  }
  
  return audioSource;
};

const initializeAudioContext = () => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('AudioContext is not available in server-side environment');
  }
  
  // Try to create AudioContext with fallback for older browsers
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  
  if (!AudioContextClass) {
    throw new Error('AudioContext is not supported in this browser');
  }
  
  // Safari/iOS specific optimizations
  const audioContext = new AudioContextClass({
    latencyHint: 'interactive',
    sampleRate: 44100, // Standardize sample rate for better compatibility
  });
  
  // Safari/iOS audio session optimization
  if (typeof navigator !== 'undefined' && navigator.audioSession) {
    try {
      navigator.audioSession.type = 'playback';
    } catch (e) {
      // Ignore if not available
    }
  }

  // Additional iOS/Safari mobile optimizations for background playback
  if (typeof navigator !== 'undefined') {
    // Prevent iOS from suspending audio context during background
    if (navigator.userAgent.includes('Safari') || navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
      try {
        // Request persistent audio session for iOS
        if (navigator.mediaSession) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'beats-surround Audio Player',
            artist: 'beat-surround',
            album: 'Synchronized Audio'
          });
          
          // Set action handlers to prevent suspension
          navigator.mediaSession.setActionHandler('play', () => {
            // Resume audio context if suspended
            if (audioContext.state === 'suspended') {
              audioContext.resume();
            }
          });
          
          navigator.mediaSession.setActionHandler('pause', () => {
            // Keep context alive but paused
          });
        }
        
        // Request wake lock to prevent screen-related audio suspension
        if ('wakeLock' in navigator && navigator.wakeLock) {
          navigator.wakeLock.request('screen').catch(() => {
            // Wake lock not available, continue without it
          });
        }
      } catch (e) {
        // Continue without these optimizations if not available
      }
    }
  }
  
  return audioContext;
};

const fetchDefaultAudioSources = async () => {
  try {
    // Fetch demo audio sources from R2 bucket
    const r2AudioFiles = await fetchDefaultAudioFiles();
    
    if (r2AudioFiles && r2AudioFiles.length > 0) {
      return r2AudioFiles.map(file => ({
        url: file.url,
        name: file.name,
        id: file.id,
        type: 'r2-default',
        size: file.size
      }));
    }
    
    return [];
  } catch (error) {
    // Return empty array on error
    return [];
  }
};

const calculateWaitTimeMilliseconds = (targetServerTime, offsetEstimate) => {
  const now = Date.now();
  const serverNow = now + offsetEstimate;
  return Math.max(0, targetServerTime - serverNow);
};

const extractDefaultFileName = (url) => {
  const segments = url.split('/');
  const filename = segments[segments.length - 1];
  return filename.split('.')[0] || 'Unknown Track';
};

// Helper function for calculating NTP offset estimates
const calculateOffsetEstimate = (measurements) => {
  if (measurements.length === 0) {
    return { averageOffset: 0, averageRoundTrip: 0 };
  }

  // Sort by round trip time and take the best 50%
  const sortedMeasurements = [...measurements].sort((a, b) => a.roundTripDelay - b.roundTripDelay);
  const bestMeasurements = sortedMeasurements.slice(0, Math.ceil(sortedMeasurements.length * 0.5));

  const totalOffset = bestMeasurements.reduce((sum, m) => sum + m.clockOffset, 0);
  const totalRoundTrip = bestMeasurements.reduce((sum, m) => sum + m.roundTripDelay, 0);

  return {
    averageOffset: totalOffset / bestMeasurements.length,
    averageRoundTrip: totalRoundTrip / bestMeasurements.length,
  };
};

export const useGlobalStore = create((set, get) => {
  // Mutex to prevent concurrent operations
  let sourceLoadingInProgress = false;
  let audioContextInitInProgress = false;
  
  // Safety timeout to reset stuck initialization flags
  let initTimeoutId = null;
  
  // Decode any audio sources that are pending decoding
  const decodePendingAudioSources = async () => {
    const state = get();
    const { audioSources, audioPlayer } = state;
    
    if (!audioPlayer?.audioContext) {
      return;
    }
    
    const sourcesToUpdate = [];
    
    // Find sources that need decoding
    for (const source of audioSources) {
      if (source.needsDecoding && source.rawAudioBuffer && !source.audioBuffer) {
        try {
          const audioBuffer = await audioPlayer.audioContext.decodeAudioData(source.rawAudioBuffer.slice());
          sourcesToUpdate.push({
            ...source,
            audioBuffer,
            duration: audioBuffer.duration,
            needsDecoding: false,
            rawAudioBuffer: undefined // Remove raw buffer to save memory
          });
        } catch (error) {
          // Keep the source as-is if decoding fails
          sourcesToUpdate.push(source);
        }
      } else {
        // Keep source as-is
        sourcesToUpdate.push(source);
      }
    }
    
    // Update state with decoded sources
    if (sourcesToUpdate.length > 0) {
      set({ audioSources: sourcesToUpdate });
      
      // Update duration if the selected source was decoded
      const selectedSource = sourcesToUpdate.find(s => s.id === state.selectedAudioId);
      if (selectedSource?.audioBuffer) {
        set({ duration: selectedSource.audioBuffer.duration });
      }
    }
  };
  
  // Reset function for stuck initialization
  const resetInitializationFlags = () => {
    sourceLoadingInProgress = false;
    audioContextInitInProgress = false;
    set({ 
      isLoadingSources: false, 
      isInitingAudioContext: false 
    });
    if (initTimeoutId) {
      clearTimeout(initTimeoutId);
      initTimeoutId = null;
    }
  };
  
  // Function to load audio sources without decoding (no AudioContext needed)
  const loadAudioSources = async () => {
    if (sourceLoadingInProgress) {
      return;
    }
    
    sourceLoadingInProgress = true;
    set({ isLoadingSources: true });
    
    try {
      const demoAudioList = await fetchDefaultAudioSources();
      const loadedSources = [];
      
      // Load audio metadata and raw buffers from demo/default sources without decoding
      for (const audioInfo of demoAudioList) {
        try {
          const audioSource = await loadAudioSourceMetadata({ 
            url: audioInfo.url, 
            expectedTitle: audioInfo.expectedTitle || audioInfo.name,
            expectedArtist: audioInfo.expectedArtist || 'Unknown Artist'
          });
          
          loadedSources.push(audioSource);
          
        } catch (loadError) {
          // Silently continue if source fails to load
        }
      }
      
      // Load cached user-uploaded audio files (restore them on page refresh)
      try {
        const cachedAudioList = await getAllCachedAudio();
        
        for (const cachedAudio of cachedAudioList) {
          // Skip demo sources that are already loaded and files without upload timestamp
          if ((cachedAudio.type === 'r2-default' || cachedAudio.type === 'local') || !cachedAudio.uploadedAt) {
            continue;
          }
          
          try {
            const cached = await getCachedAudio(cachedAudio.id);
            if (cached && cached.arrayBuffer) {
              const audioSource = {
                id: cachedAudio.id,
                name: cachedAudio.name,
                artist: cachedAudio.artist || 'Unknown Artist',
                album: cachedAudio.album,
                albumArtist: cachedAudio.albumArtist,
                year: cachedAudio.year,
                genre: cachedAudio.genre,
                coverArt: cachedAudio.coverArt,
                estimatedDuration: cachedAudio.duration,
                rawAudioBuffer: cached.arrayBuffer,
                audioBuffer: null, // Will be decoded when AudioContext is available
                url: cachedAudio.url,
                type: cachedAudio.type || 'user-upload',
                metadata: cached.metadata,
                needsDecoding: true,
                uploadedAt: cachedAudio.uploadedAt,
                cachedAt: cachedAudio.cachedAt
              };
              
              loadedSources.push(audioSource);
            }
          } catch (cacheError) {
            // Continue if caching fails
          }
        }
      } catch (cacheLoadError) {
        // Continue without cached files
      }
      
      if (loadedSources.length === 0) {
        set({
          audioSources: [],
          audioSourcesLoaded: true,
          isLoadingSources: false
        });
        return;
      }
      
      // Sort sources: demo files first, then user uploads by upload time (newest first)
      loadedSources.sort((a, b) => {
        // Demo files first
        if ((a.type === 'r2-default' || a.type === 'local') && !(b.type === 'r2-default' || b.type === 'local')) {
          return -1;
        }
        if (!(a.type === 'r2-default' || a.type === 'local') && (b.type === 'r2-default' || b.type === 'local')) {
          return 1;
        }
        
        // For user uploads, sort by upload time (newest first)
        if (a.uploadedAt && b.uploadedAt) {
          return b.uploadedAt - a.uploadedAt;
        }
        
        // If no upload time, sort by name
        return (a.name || '').localeCompare(b.name || '');
      });
      
      const firstSource = loadedSources[0];
      
      set({
        audioSources: loadedSources,
        audioSourcesLoaded: true,
        selectedAudioId: firstSource.id,
        duration: firstSource.estimatedDuration || 0, // Use estimated duration from metadata
        isLoadingSources: false
      });
      
    } catch (error) {
      set({ 
        isLoadingSources: false,
        audioSourcesLoaded: true // Mark as loaded even on error to prevent infinite retries
      });
    } finally {
      sourceLoadingInProgress = false;
    }
  };
  
  // Function to initialize audio context when needed for playback
  const initializeAudioContext = async () => {
    const state = get();
    
    // Return early if already initialized and running
    if (state.audioPlayer?.audioContext?.state === 'running') {
      return true;
    }
    
    if (audioContextInitInProgress) {
      return false;
    }
    
    audioContextInitInProgress = true;
    set({ isInitingAudioContext: true });
    
    // Safety timeout to prevent getting stuck
    initTimeoutId = setTimeout(() => {
      resetInitializationFlags();
    }, 10000); // 10 second timeout
    
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        throw new Error('Server environment not supported');
      }
      
      let audioContext;
      
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
          latencyHint: 'interactive',
          sampleRate: 44100,
        });
      } catch (audioContextError) {
        throw audioContextError;
      }
      
      // IMPORTANT: Only try to resume if user has interacted
      // This prevents autoplay policy violations
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume();
        } catch (resumeError) {
          // Don't throw here - suspended context is still usable for later resumption
        }
      }
      
      // Create master gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.8;
      gainNode.connect(audioContext.destination);
      
      // Create a placeholder source node
      const sourceNode = audioContext.createBufferSource();
      sourceNode.connect(gainNode);
      
      // Set audio player state
      set({
        audioPlayer: {
          audioContext,
          sourceNode,
          gainNode,
          suspended: audioContext.state === 'suspended',
          syncEngine: getSyncEngine(),
          audioController: getAudioController(audioContext)
        },
        isInitingAudioContext: false,
        hasUserInteracted: true // Mark that user has interacted
      });
      
      // Update suspended state after potential resume
      if (audioContext.state === 'running') {
        set((state) => ({
          audioPlayer: {
            ...state.audioPlayer,
            suspended: false
          }
        }));
      }
      
      // Decode any pending audio sources that need decoding
      await decodePendingAudioSources();
      
      // Start mobile Safari monitoring for background playback
      get().startMobileSafariMonitor();
      
      // Initialize mobile audio features (Media Session API, wake lock, service worker)
      try {
        await initializeMobileAudio(get);
      } catch (mobileError) {
        // Mobile audio initialization failed - continue without mobile features
      }
    
      return true;
      
    } catch (error) {
      set({ 
        isInitingAudioContext: false,
        audioPlayer: null
      });
      return false;
    } finally {
      audioContextInitInProgress = false;
      if (initTimeoutId) {
        clearTimeout(initTimeoutId);
        initTimeoutId = null;
      }
    }
  };
  
  // Legacy function for backward compatibility - now just calls both functions
  const initializeAudio = async () => {
    const state = get();
    
    // Load sources if not already loaded
    if (!state.audioSourcesLoaded) {
      await loadAudioSources();
    }
    
    // Initialize audio context
    return await initializeAudioContext();
  };

  // Remove automatic initialization on mount - let AudioInitializer handle it
  // This prevents premature initialization before user interaction

  return {
    // Initialize with initialState
    ...initialState,

    // New separate methods for better control
    loadAudioSources,
    initializeAudioContext,
    
    // Legacy method for backward compatibility
    initializeAudio,

    // Enhanced method to resume audio context (inspired by BeatSync approach)
    resumeAudioContext: async () => {
      const state = get();
      
      if (!state.audioPlayer?.audioContext) {
        // If no audio context exists, try to initialize it
        try {
          const success = await get().initializeAudioContext();
          return success;
        } catch (error) {
          return false;
        }
      }
      
      const { audioContext } = state.audioPlayer;
      
      try {
        // Check if context needs resuming
        if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
          await audioContext.resume();
          
          // Give it a moment to transition states
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Verify context is actually running
          if (audioContext.state === 'running') {
            // Update state to reflect successful resume
            set({
              audioPlayer: {
                ...state.audioPlayer,
                suspended: false,
              },
              hasUserInteracted: true
            });
            
            return true;
          } else {
            return false;
          }
          
        } else if (audioContext.state === 'running') {
          // Ensure state is consistent
          set({
            audioPlayer: {
              ...state.audioPlayer,
              suspended: false,
            },
            hasUserInteracted: true
          });
          
          return true;
        } else if (audioContext.state === 'closed') {
          return false;
        }
        
      } catch (error) {
        // Try to create a fresh audio context as fallback
        try {
          const newAudioContext = initializeAudioContext();
          
          if (newAudioContext.state === 'running') {
            // Create new gain node
            const gainNode = newAudioContext.createGain();
            gainNode.gain.value = state.volume || 0.8;
            gainNode.connect(newAudioContext.destination);
            
            // Create new source node
            const sourceNode = newAudioContext.createBufferSource();
            sourceNode.connect(gainNode);
            
            set({
              audioPlayer: {
                ...state.audioPlayer,
                audioContext: newAudioContext,
                gainNode,
                sourceNode,
                suspended: false,
                syncEngine: getSyncEngine(),
                audioController: getAudioController(newAudioContext)
              }
            });
            
            return true;
          }
          
        } catch (fallbackError) {
          // Silent fallback failure
        }
      }
      
      return false;
    },

    // Mobile Safari background playback monitor and recovery
    startMobileSafariMonitor: () => {
      if (typeof window === 'undefined') return;
      
      const state = get();
      
      // Only start monitor for mobile Safari/iOS
      const isMobileSafari = /Safari/.test(navigator.userAgent) && 
                            (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
                             (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 0));
      
      if (!isMobileSafari) return;
      
      // Monitor visibility changes to detect screen lock/unlock
      const handleVisibilityChange = async () => {
        if (!document.hidden && state.audioPlayer?.audioContext) {
          // Screen is visible again - try to resume audio context
          const { audioContext } = state.audioPlayer;
          
          if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
            try {
              await audioContext.resume();
            } catch (e) {
              // Try to reinitialize if resume fails
              state.resumeAudioContext();
            }
          }
        }
      };
      
      // Monitor audio context state changes
      const handleStateChange = async () => {
        const audioContext = state.audioPlayer?.audioContext;
        if (!audioContext) return;
        
        if (audioContext.state === 'suspended' && state.isPlaying) {
          // Audio was suspended while playing - try to resume
          try {
            await audioContext.resume();
          } catch (e) {
            // Resume failed, mark as suspended but keep playing state
            set({
              audioPlayer: {
                ...state.audioPlayer,
                suspended: true
              }
            });
          }
        }
      };
      
      // Add event listeners
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      if (state.audioPlayer?.audioContext) {
        state.audioPlayer.audioContext.addEventListener('statechange', handleStateChange);
      }
      
      // Periodic audio context health check for mobile Safari
      const healthCheckInterval = setInterval(async () => {
        const currentState = get();
        const audioContext = currentState.audioPlayer?.audioContext;
        
        if (!audioContext) return;
        
        // If we're supposed to be playing but context is suspended, try to resume
        if (currentState.isPlaying && audioContext.state === 'suspended') {
          try {
            await audioContext.resume();
          } catch (e) {
            // Resume failed - try to reinitialize
            currentState.resumeAudioContext();
          }
        }
      }, 2000); // Check every 2 seconds
      
      // Store cleanup function
      set({
        mobileSafariCleanup: () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          if (state.audioPlayer?.audioContext) {
            state.audioPlayer.audioContext.removeEventListener('statechange', handleStateChange);
          }
          clearInterval(healthCheckInterval);
        }
      });
    },

    // Audio control methods
    playAudio: async ({ offset = 0, when = 0, audioIndex = 0 }) => {
      const state = get();
      
      // Ensure AudioContext is running before playback (crucial for mobile Safari)
      if (state.audioPlayer?.audioContext) {
        const { audioContext } = state.audioPlayer;
        
        if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
          try {
            await audioContext.resume();
            // Give it time to resume
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (e) {
            // Failed to resume AudioContext before playback
            return;
          }
        }
        
        // Final check - if still not running, abort
        if (audioContext.state !== 'running') {
          // AudioContext not running, aborting playback
          return;
        }
      }
      
      // Use AudioController for enhanced playback
      if (state.audioController) {
        const audioBuffer = state.audioSources[audioIndex].audioBuffer;
        const { audioContext } = getAudioPlayer(state);
        const startTime = audioContext.currentTime + when;
        
        state.audioController.play(audioBuffer, offset, startTime);
        
        set((state) => ({
          ...state,
          isPlaying: true,
          duration: audioBuffer.duration || 0,
        }));
        
        // Notify service worker about audio state
        notifyServiceWorkerAudioState(true);
        
        return;
      }

      // Fallback to legacy method
      const { sourceNode: oldSourceNode, audioContext, gainNode } = getAudioPlayer(state);

      // Before any audio playback, ensure the context is running
      if (audioContext.state !== "running") {
        audioContext.resume().then(() => {
          // Retry play after context is resumed
          state.playAudio({ offset, when: Math.max(0, when - 0.1), audioIndex });
        }).catch(() => {
          toast.error("Audio context is suspended. Please try again.");
        });
        return;
      }

      // CRITICAL: Stop and disconnect any existing source node
      if (oldSourceNode) {
        try {
          oldSourceNode.stop();
          oldSourceNode.disconnect();
        } catch (_) {
          // Ignore errors if already stopped
        }
      }

      const startTime = audioContext.currentTime + when;
      const audioBuffer = state.audioSources[audioIndex].audioBuffer;

      if (!audioBuffer) {
        return;
      }

      // Create a NEW source node (Web Audio API requirement)
      const newSourceNode = audioContext.createBufferSource();
      newSourceNode.buffer = audioBuffer;
      newSourceNode.connect(gainNode);

      // Enhanced onended handler with better logic
      newSourceNode.onended = () => {
        const currentState = get();
        const { audioPlayer: currentPlayer, isPlaying: currentlyIsPlaying } = currentState;

        // Only process if this source node is still the current one and we're still playing
        if (currentlyIsPlaying && currentPlayer?.sourceNode === newSourceNode) {
          const { audioContext } = currentPlayer;
          
          // Check if the buffer naturally reached its end
          const expectedEndTime = currentState.playbackStartTime + 
                                  (currentState.duration - currentState.playbackOffset);
          const endedNaturally = Math.abs(audioContext.currentTime - expectedEndTime) < 0.5;

          if (endedNaturally) {
            // Set currentTime to duration to show completion
            set({ currentTime: currentState.duration });
            // Auto-skip to next track
            setTimeout(() => currentState.skipToNextTrack(true), 100);
          }
        }
      };

      // Start playback with proper offset handling
      try {
        newSourceNode.start(startTime, offset);
      } catch (error) {
        toast.error("Failed to start audio playback");
        return;
      }

      // Update player state with new source node and timing info
      set((state) => ({
        ...state,
        isPlaying: true,
        audioPlayer: {
          ...state.audioPlayer,
          sourceNode: newSourceNode,
        },
        playbackStartTime: startTime,
        playbackOffset: offset,
        duration: audioBuffer.duration || 0,
      }));
      
      // Notify service worker about audio state
      notifyServiceWorkerAudioState(true);
    },

    pauseAudio: ({ when = 0 }) => {
      const state = get();
      
      // Use AudioController for enhanced pause
      if (state.audioController) {
        const { audioContext } = getAudioPlayer(state);
        const stopTime = audioContext.currentTime + when;
        state.audioController.pause(stopTime);
        
        // Update current time to the pause position
        const currentPos = state.getCurrentTrackPosition();
        set({ 
          isPlaying: false,
          currentTime: currentPos 
        });
        
        // Notify service worker about audio state
        notifyServiceWorkerAudioState(false);
        
        return;
      }

      // Fallback to legacy method
      const { sourceNode, audioContext } = getAudioPlayer(state);

      // Calculate current position before stopping
      const currentTime = audioContext.currentTime;
      const elapsed = currentTime - state.playbackStartTime;
      const currentPosition = Math.max(0, state.playbackOffset + elapsed);

      const stopTime = audioContext.currentTime + when;
      
      try {
        sourceNode.stop(stopTime);
        sourceNode.disconnect();
      } catch (error) {
        // Source may already be stopped
      }

      set({ 
        isPlaying: false,
        currentTime: Math.min(currentPosition, state.duration)
      });
      
      // Notify service worker about audio state
      notifyServiceWorkerAudioState(false);
    },

    // Track selection and management
    setSelectedAudioId: (audioId) => {
      const state = get();
      const wasPlaying = state.isPlaying;

      // Stop current playback COMPLETELY
      if (state.audioPlayer?.sourceNode) {
        try {
          // Stop the current source node immediately
          state.audioPlayer.sourceNode.stop();
          state.audioPlayer.sourceNode.disconnect();
        } catch (_) {
          // Ignore errors if already stopped
        }
      }

      // Find the selected audio source
      const selectedSource = state.audioSources.find(source => source.id === audioId);
      
      // Reset all timing state when changing tracks
      set({ 
        selectedAudioId: audioId,
        isPlaying: false,
        currentTime: 0,
        playbackStartTime: 0,
        playbackOffset: 0,
        duration: selectedSource ? selectedSource.audioBuffer?.duration || 0 : 0,
      });

      return wasPlaying; // Return true if it WAS playing before
    },

    findAudioIndexById: (audioId) => {
      const state = get();
      const index = state.audioSources.findIndex(source => source.id === audioId);
      return index >= 0 ? index : null;
    },

    // Playback controls
    broadcastPlay: (trackTimeSeconds) => {
      const state = get();
      
      if (!state.selectedAudioId) {
        return;
      }

      // Send WebSocket message if connected
      if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({
          type: 'PLAY',
          audioId: state.selectedAudioId,
          trackTimeSeconds: trackTimeSeconds || 0
        }));
      } else {
        // Fallback to local playback
        const audioIndex = state.findAudioIndexById(state.selectedAudioId);
        if (audioIndex !== null) {
          state.playAudio({
            offset: trackTimeSeconds || 0,
            when: 0,
            audioIndex,
          });
        }
      }
    },

    broadcastPause: () => {
      const state = get();
      
      // Send WebSocket message if connected
      if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({
          type: 'PAUSE'
        }));
      } else {
        // Fallback to local pause
        state.pauseAudio({ when: 0 });
      }
    },

    // Track navigation
    skipToNextTrack: (isAutoplay = false) => {
      const state = get();
      const { audioSources, selectedAudioId, isShuffled } = state;
      if (audioSources.length <= 1) return;

      const currentIndex = state.findAudioIndexById(selectedAudioId);
      if (currentIndex === null) return;

      let nextIndex;
      if (isShuffled) {
        do {
          nextIndex = Math.floor(Math.random() * audioSources.length);
        } while (nextIndex === currentIndex && audioSources.length > 1);
      } else {
        nextIndex = (currentIndex + 1) % audioSources.length;
      }

      const nextAudioId = audioSources[nextIndex].id;
      
      // setSelectedAudioId now returns true if music WAS playing before
      const wasPlayingBeforeSkip = state.setSelectedAudioId(nextAudioId);

      // If music was playing before skip, or this is autoplay, start playing the new track
      if (wasPlayingBeforeSkip || isAutoplay) {
        // Small delay to ensure state is updated
        setTimeout(() => {
          state.broadcastPlay(0);
        }, 50);
      }
    },

    skipToPreviousTrack: () => {
      const state = get();
      const { audioSources, selectedAudioId, isShuffled } = state;
      if (audioSources.length <= 1 || isShuffled) return;

      const currentIndex = state.findAudioIndexById(selectedAudioId);
      if (currentIndex === null) return;

      const prevIndex = currentIndex === 0 ? audioSources.length - 1 : currentIndex - 1;
      const prevAudioId = audioSources[prevIndex].id;
      
      // setSelectedAudioId now returns true if music WAS playing before  
      const wasPlayingBeforeSkip = state.setSelectedAudioId(prevAudioId);

      if (wasPlayingBeforeSkip) {
        setTimeout(() => {
          state.broadcastPlay(0);
        }, 50);
      }
    },

    toggleShuffle: () => set((state) => ({ isShuffled: !state.isShuffled })),

    // Current time tracking
    getCurrentTrackPosition: () => {
      const state = get();
      
      if (!state.isPlaying) {
        return state.currentTime;
      }
      
      if (state.audioController) {
        // Use high-precision position tracking from AudioController
        return state.audioController.getCurrentPosition();
      }
      
      // Fallback: calculate position based on audio context time
      if (state.audioPlayer?.audioContext && state.playbackStartTime > 0) {
        const { audioContext } = state.audioPlayer;
        const elapsed = audioContext.currentTime - state.playbackStartTime;
        const position = Math.max(0, state.playbackOffset + elapsed);
        return Math.min(position, state.duration);
      }
      
      return state.currentTime;
    },

    // Audio source management
    addAudioSource: async (source) => {
      const state = get();
      
      try {
        // Handle audio decoding
        let audioBuffer;
        let audioBufferForCache = source.audioBuffer;
        
        if (source.audioBuffer instanceof AudioBuffer) {
          // Already decoded
          audioBuffer = source.audioBuffer;
        } else if (source.needsDecoding && source.rawAudioBuffer) {
          // This source needs decoding and we have the raw buffer
          if (state.audioPlayer?.audioContext) {
            // We have an AudioContext, decode now
            audioBuffer = await state.audioPlayer.audioContext.decodeAudioData(source.rawAudioBuffer.slice());
            audioBufferForCache = source.rawAudioBuffer;
          } else {
            // No AudioContext yet, keep as-is and decode later
            audioBuffer = null;
            audioBufferForCache = source.rawAudioBuffer;
          }
        } else {
          // Need to decode the provided buffer
          if (!state.audioPlayer?.audioContext) {
            throw new Error('AudioContext not available for decoding audio');
          }
          audioBuffer = await state.audioPlayer.audioContext.decodeAudioData(source.audioBuffer);
        }
        
        // Determine if this is a user upload and add timestamp if needed
        const isUserUpload = source.type && 
          source.type !== 'r2-default' && 
          source.type !== 'local' && 
          source.type !== 'url-loaded';
        
        const uploadedAt = source.uploadedAt || (isUserUpload ? Date.now() : undefined);
        
        // Cache the audio data for future use if not already cached
        const isAlreadyCached = await isCached(source.id);
        if (!isAlreadyCached && audioBufferForCache) {
          const metadata = {
            name: source.name,
            artist: source.artist,
            album: source.album,
            albumArtist: source.albumArtist,
            year: source.year,
            genre: source.genre,
            duration: audioBuffer?.duration || source.estimatedDuration,
            coverArt: source.coverArt,
            url: source.url,
            type: source.type,
            uploadedAt: uploadedAt
          };
          
          // Cache asynchronously - don't block the UI
          cacheAudio(source.id, audioBufferForCache, metadata).catch(() => {});
        }
        
        const newAudioSource = {
          name: source.name,
          audioBuffer,
          id: source.id,
          // Store raw buffer for later decoding if needed
          ...(source.rawAudioBuffer && !audioBuffer && { rawAudioBuffer: source.rawAudioBuffer, needsDecoding: true }),
          // Preserve metadata if available
          ...(source.artist && { artist: source.artist }),
          ...(source.album && { album: source.album }),
          ...(source.albumArtist && { albumArtist: source.albumArtist }),
          ...(source.year && { year: source.year }),
          ...(source.genre && { genre: source.genre }),
          ...(source.coverArt && { coverArt: source.coverArt }),
          ...(source.metadata && { metadata: source.metadata }),
          ...(source.url && { url: source.url }),
          ...(source.type && { type: source.type }),
          ...(uploadedAt && { uploadedAt: uploadedAt }),
          ...(source.estimatedDuration && { estimatedDuration: source.estimatedDuration }),
        };

        set((state) => ({
          audioSources: [...state.audioSources, newAudioSource],
          ...(source.id === state.selectedAudioId ? { 
            duration: audioBuffer?.duration || source.estimatedDuration || 0 
          } : {}),
        }));

        state.markAudioAsDownloaded(source.id);
        state.addToUploadHistory(source.name, source.id);
      } catch (error) {
        // Silently handle errors
      }
    },

    // WebSocket and synchronization
    setSocket: (socket) => set({ socket }),

    // Individual setter functions for WebSocket manager compatibility
    setNtpMeasurements: (measurements) => set({ ntpMeasurements: measurements }),
    setOffsetEstimate: (offset) => set({ offsetEstimate: offset }),
    setRoundTripEstimate: (rtt) => set({ roundTripEstimate: rtt }),
    setIsSynced: (synced) => set({ isSynced: synced }),

    // Connection status setters
    setConnectionStatus: (status) => set((state) => ({ 
      connectionStatus: { ...state.connectionStatus, ...status } 
    })),
    updateConnectionMetrics: (metrics) => set((state) => ({
      connectionStatus: { 
        ...state.connectionStatus, 
        ...metrics,
        uptime: state.connectionStatus.connectionStartTime ? 
          Date.now() - state.connectionStatus.connectionStartTime : 0
      }
    })),

    // Sync quality setters
    setSyncQuality: (quality) => set((state) => ({ 
      syncQuality: { ...state.syncQuality, ...quality, lastUpdate: Date.now() } 
    })),
    updateSyncQuality: (metrics) => set((state) => {
      const newQuality = { ...state.syncQuality, ...metrics, lastUpdate: Date.now() };
      
      // Calculate quality level based on metrics with more reasonable thresholds
      let qualityLevel = 'unknown';
      if (newQuality.latency > 0) {
        if (newQuality.latency < 100 && newQuality.jitter < 20 && newQuality.accuracy > 0.85) {
          qualityLevel = 'excellent';
        } else if (newQuality.latency < 200 && newQuality.jitter < 40 && newQuality.accuracy > 0.75) {
          qualityLevel = 'good';
        } else if (newQuality.latency < 350 && newQuality.jitter < 80 && newQuality.accuracy > 0.6) {
          qualityLevel = 'fair';
        } else {
          qualityLevel = 'poor';
        }
      }
      
      return { syncQuality: { ...newQuality, qualityLevel } };
    }),

    // NTP synchronization functions
    sendNTPRequest: () => {
      const state = get();
      if (state.ntpMeasurements.length >= MAX_NTP_MEASUREMENTS) {
        const { averageOffset, averageRoundTrip } = calculateOffsetEstimate(state.ntpMeasurements);
        set({
          offsetEstimate: averageOffset,
          roundTripEstimate: averageRoundTrip,
          isSynced: true,
        });

        if (averageRoundTrip > 750) {
          toast.error("Latency is very high (>750ms). Sync may be unstable.");
        }
        return;
      }

      // Send NTP request if we have a connected socket
      if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        const t0 = Date.now();
        state.socket.send(JSON.stringify({
          type: 'NTP_REQUEST',
          t0
        }));
      }
    },

    resetNTPConfig: () => {
      set({
        ntpMeasurements: [],
        offsetEstimate: 0,
        roundTripEstimate: 0,
        isSynced: false,
      });
    },

    addNTPMeasurement: (measurement) => {
      const state = get();
      const newMeasurements = [...state.ntpMeasurements, measurement];
      
      // Keep only the most recent measurements
      if (newMeasurements.length > MAX_NTP_MEASUREMENTS) {
        newMeasurements.shift();
      }
      
      set({ ntpMeasurements: newMeasurements });
      
      // Update estimates if we have enough measurements
      if (newMeasurements.length >= 5) {
        const { averageOffset, averageRoundTrip } = calculateOffsetEstimate(newMeasurements);
        
        // Calculate sync quality metrics
        const recentMeasurements = newMeasurements.slice(-10); // Use last 10 measurements
        const latencies = recentMeasurements.map(m => m.roundTripDelay);
        const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
        
        // Calculate jitter (variance in latency)
        const jitter = Math.sqrt(
          latencies.reduce((sum, l) => sum + Math.pow(l - avgLatency, 2), 0) / latencies.length
        );
        
        // Calculate accuracy based on consistency of measurements
        const maxLatency = Math.max(...latencies);
        const minLatency = Math.min(...latencies);
        const latencyVariance = maxLatency - minLatency;
        
        // Improved accuracy calculation that doesn't penalize low latency too much
        // Use a more reasonable baseline for accuracy calculation
        const baselineLatency = Math.max(avgLatency, 50); // Use at least 50ms as baseline
        const accuracy = Math.max(0, Math.min(1, 1 - (latencyVariance / baselineLatency)));
        
        // If latency variance is very low, boost accuracy
        if (latencyVariance < 10) {
          const boostedAccuracy = Math.min(1, accuracy + 0.2);
          var finalAccuracy = boostedAccuracy;
        } else {
          var finalAccuracy = accuracy;
        }
        
        // Update both sync estimates and quality
        set({
          offsetEstimate: averageOffset,
          roundTripEstimate: averageRoundTrip,
          isSynced: newMeasurements.length >= 10,
        });
        
        // Update sync quality using the new function
        const updateSyncQuality = get().updateSyncQuality;
        updateSyncQuality({
          latency: avgLatency,
          jitter,
          accuracy: finalAccuracy,
          clockDrift: 0 // Could be calculated from offset changes over time
        });
      }
    },

    // Scheduled audio actions for WebSocket synchronization
    schedulePlay: ({ trackTimeSeconds, targetServerTime, audioId }) => {
      const state = get();
      const { offsetEstimate } = state;
      
      // Calculate when to execute based on server time and our offset
      const now = Date.now();
      const serverNow = now + offsetEstimate;
      const waitTime = Math.max(0, targetServerTime - serverNow);
      
      setTimeout(() => {
        if (audioId && audioId !== state.selectedAudioId) {
          state.setSelectedAudioId(audioId);
        }
        
        // Find the correct audio index for the selected audio ID
        const currentState = get();
        const audioIndex = currentState.findAudioIndexById(audioId || currentState.selectedAudioId);
        
        if (audioIndex !== null) {
          currentState.playAudio({ 
            when: 0, 
            offset: trackTimeSeconds || 0,
            audioIndex
          });
        }
      }, waitTime);
    },

    schedulePause: ({ targetServerTime }) => {
      const state = get();
      const { offsetEstimate } = state;
      
      // Calculate when to execute based on server time and our offset
      const now = Date.now();
      const serverNow = now + offsetEstimate;
      const waitTime = Math.max(0, targetServerTime - serverNow);
      
      setTimeout(() => {
        state.pauseAudio({ when: 0 });
      }, waitTime);
    },

    // Room management
    setConnectedClients: (clients) => set({ connectedClients: clients }),

    // Upload tracking
    addToUploadHistory: (name, id) =>
      set((state) => ({
        uploadHistory: [
          ...state.uploadHistory,
          { name, timestamp: Date.now(), id },
        ],
      })),

    markAudioAsDownloaded: (audioId) =>
      set((state) => ({
        downloadedAudioIds: new Set([...state.downloadedAudioIds, audioId]),
      })),

    hasDownloadedAudio: (audioId) => {
      const state = get();
      return state.downloadedAudioIds.has(audioId);
    },

    // Spatial audio support
    processSpatialConfig: (config) => {
      const state = get();
      set({ spatialConfig: config });
      
      if (!state.isDraggingListeningSource) {
        set({ listeningSourcePosition: config.listeningSource });
      }

      // Apply spatial audio gains if we have an audio player
      if (state.audioPlayer?.gainNode && config.gains) {
        // Try to get userId from room store if available
        let userId = null;
        try {
          // Dynamically access room store to avoid circular imports
          const roomStore = window.__roomStore__;
          userId = roomStore?.getState?.()?.userId;
        } catch (e) {
          // Fallback: try to find a matching client ID in connected clients
          if (state.connectedClients.length > 0) {
            userId = state.connectedClients[0]?.clientId;
          }
        }
        
        if (userId && config.gains[userId]) {
          const { gain, rampTime } = config.gains[userId];
          const { audioContext, gainNode } = state.audioPlayer;
          
          const now = audioContext.currentTime;
          const currentGain = gainNode.gain.value;
          
          gainNode.gain.cancelScheduledValues(now);
          gainNode.gain.setValueAtTime(currentGain, now);
          gainNode.gain.linearRampToValueAtTime(gain, now + (rampTime || 0.25));
        }
      }
    },

    setListeningSourcePosition: (position) => set({ listeningSourcePosition: position }),
    setIsDraggingListeningSource: (isDragging) => set({ isDraggingListeningSource: isDragging }),
    setIsSpatialAudioEnabled: (isEnabled) => set({ isSpatialAudioEnabled: isEnabled }),

    processStopSpatialAudio: () => {
      const state = get();
      if (state.audioPlayer?.gainNode) {
        const { gainNode } = state.audioPlayer;
        gainNode.gain.cancelScheduledValues(0);
        gainNode.gain.value = 1;
      }
      
      set({ 
        isSpatialAudioEnabled: false,
        spatialConfig: null 
      });
    },

    // Spatial audio actions (mock implementations)
    startSpatialAudio: () => {
      set({ isSpatialAudioEnabled: true });
    },

    sendStopSpatialAudio: () => {
      set({ isSpatialAudioEnabled: false });
    },

    // Audio cache management
    clearAudioCache: async () => {
      try {
        const cache = simpleCacheModule.instance;
        if (cache) {
          await cache.clearAll();
          toast.success('Audio cache cleared');
        }
      } catch (error) {
        toast.error('Failed to clear cache');
      }
    },

    clearExpiredCache: async () => {
      try {
        const cache = simpleCacheModule.instance;
        if (cache) {
          const removedCount = await cache.clearExpired();
          if (removedCount > 0) {
            toast.success(`Removed ${removedCount} expired cache entries`);
          }
        }
      } catch (error) {
        // Silently handle errors
      }
    },

    getCacheStats: async () => {
      try {
        const cache = simpleCacheModule.instance;
        if (cache) {
          return await cache.getCacheStats();
        }
        return { count: 0, totalSize: 0 };
      } catch (error) {
        return { count: 0, totalSize: 0 };
      }
    },

    // Reset function
    resetStore: async () => {
      const state = get();

      // Stop any playing audio and clean up audio player
      if (state.audioPlayer) {
        try {
          if (state.audioPlayer.sourceNode) {
            state.audioPlayer.sourceNode.stop();
            state.audioPlayer.sourceNode.disconnect();
          }
          if (state.audioPlayer.gainNode) {
            state.audioPlayer.gainNode.disconnect();
          }
          if (state.audioPlayer.audioContext && state.audioPlayer.audioContext.state !== 'closed') {
            state.audioPlayer.audioContext.close();
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Close WebSocket connection
      if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.close();
      }

      // Clear audio cache when leaving room
      try {
        const cache = simpleCacheModule.instance;
        if (cache) {
          await cache.clearAll();
        }
      } catch (error) {
        // Silently handle cache clearing errors
      }

      // Reset to initial state but keep room-specific settings
      set({
        ...initialState,
        // Allow re-initialization for new room
        isInitingSystem: false,
      });
    },

    // Reset audio for room changes (lighter reset that preserves room state)
    resetAudioForRoom: () => {
      const state = get();

      // Stop any playing audio
      if (state.audioPlayer?.sourceNode) {
        try {
          state.audioPlayer.sourceNode.stop();
          state.audioPlayer.sourceNode.disconnect();
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Reset audio-related state but keep demo sources and their loaded state
      // Only clear user-uploaded content and playback state
      const demoSources = state.audioSources.filter(source => 
        source.type === 'r2-default' || source.type === 'local'
      );
      
      set({
        // Keep demo audio sources, only clear user uploads
        audioSources: demoSources,
        selectedAudioId: demoSources.length > 0 ? demoSources[0].id : null,
        isPlaying: false,
        currentTime: 0,
        duration: demoSources.length > 0 ? demoSources[0].audioBuffer?.duration || 0 : 0,
        playbackStartTime: 0,
        playbackOffset: 0,
        audioPlayer: null,
        // Keep audioSourcesLoaded true if we have demo sources
        audioSourcesLoaded: demoSources.length > 0 ? true : false,
        // Only clear user-uploaded content tracking
        downloadedAudioIds: new Set(),
        uploadHistory: [],
        isInitingSystem: false, // Allow re-initialization
      });
    },

    // Cleanup function for component unmounting
    cleanup: () => {
      const state = get();
      
      // Stop any playing audio
      if (state.isPlaying && state.audioPlayer?.sourceNode) {
        try {
          state.audioPlayer.sourceNode.stop();
          state.audioPlayer.sourceNode.disconnect();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      // Close WebSocket
      if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.close();
      }
      
      set({ 
        isPlaying: false, 
        socket: null,
        audioPlayer: null 
      });
    },

    // Volume control
    getCurrentGainValue: () => {
      const state = get();
      if (!state.audioPlayer) return 1;
      return state.audioPlayer.gainNode.gain.value;
    },

    resetInitializationFlags,
  };
});
