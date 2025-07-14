import { toast } from 'sonner';
import { create } from 'zustand';
import { createPlaceholderCoverArt, extractAudioMetadata } from '../lib/audioMetadata';
import { createHighPrecisionTimer, getAudioController, getSyncEngine } from '../lib/audioSync';

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
  volume: 0.5,
  isShuffled: false,
  
  // Audio sources and selection
  audioSources: [],
  selectedAudioId: null,
  
  // System state
  isInitingSystem: false, // Changed from true to false
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

const loadAudioSourceUrl = async ({ url, audioContext, expectedTitle, expectedArtist }) => {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  
  // Extract metadata (including cover art) before decoding audio
  const metadata = await extractAudioMetadata(arrayBuffer, url);
  
  // Decode audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice());
  
  // Use expected values as fallback if metadata is missing or unclear
  const finalTitle = metadata.title || expectedTitle || extractDefaultFileName(url);
  const finalArtist = metadata.artist || expectedArtist || 'Unknown Artist';
  
  return {
    name: finalTitle,
    artist: finalArtist,
    album: metadata.album,
    albumArtist: metadata.albumArtist,
    year: metadata.year,
    genre: metadata.genre,
    coverArt: metadata.coverArt || createPlaceholderCoverArt(finalTitle, finalArtist),
    duration: audioBuffer.duration,
    audioBuffer,
    id: url,
    metadata: metadata
  };
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
  
  return audioContext;
};

const fetchDefaultAudioSources = async () => {
  // Return demo audio sources from public/audio directory
  // Names will be extracted from metadata with explicit ordering
  return [
    { 
      url: '/audio/Sia%20-%20Cheap%20Thrills%20(Performance%20Edit).flac',
      expectedTitle: 'Cheap Thrills (Performance Edit)',
      expectedArtist: 'Sia'
    },
    { 
      url: '/audio/Cheap%20Thrills%20feat%20Sean%20Paul%20-%20Sia%20Sean%20Paul%20.flac',
      expectedTitle: 'Cheap Thrills (feat. Sean Paul)',
      expectedArtist: 'Sia, Sean Paul'
    },
    { 
      url: '/audio/Sunflower%20-%20Spider-Man%20Into%20the%20Spider-Verse%20-%20Post%20Malone%20Swae%20Lee%20.flac',
      expectedTitle: 'Sunflower - Spider-Man: Into the Spider-Verse',
      expectedArtist: 'Post Malone, Swae Lee'
    },
  ];
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
  // Add a timeout to prevent infinite loading
  setTimeout(() => {
    const state = get();
    if (state.isInitingSystem) {
      set({ isInitingSystem: false });
    }
  }, 30000); // 30 second timeout for loading large FLAC files
  
  // Function to initialize or reinitialize audio system
  const initializeAudio = async () => {
    
    try {
      // First, try to create a minimal audio context to test browser support
      let audioContext;
      
      try {
        audioContext = initializeAudioContext();
      } catch (audioContextError) {
        // Fallback: Initialize without audio context
        const fallbackSource = {
          name: 'Audio Unavailable',
          audioBuffer: null,
          id: 'no-audio',
        };
        
        set({
          audioSources: [fallbackSource],
          audioPlayer: null,
          downloadedAudioIds: new Set(['no-audio']),
          duration: 0,
          selectedAudioId: fallbackSource.id,
          isInitingSystem: false,
        });
        
        return;
      }
      
      // Check if audioContext is suspended (common in modern browsers with autoplay restrictions)
      if (audioContext.state === 'suspended') {
        // Continue with loading audio files even with suspended context
        // The files will be loaded but marked as requiring user interaction
      }
      
      // Create master gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1; // Default volume
      
      // Load demo audio files from public/audio directory
      try {
        const demoAudioList = await fetchDefaultAudioSources();
        const loadedSources = [];
        
        for (const audioInfo of demoAudioList) {
          try {
            const audioSource = await loadAudioSourceUrl({ 
              url: audioInfo.url, 
              audioContext,
              expectedTitle: audioInfo.expectedTitle,
              expectedArtist: audioInfo.expectedArtist
            });
            
            loadedSources.push({
              ...audioSource,
              requiresUserInteraction: audioContext.state === 'suspended', // Mark if context is suspended
            });
          } catch (loadError) {
            // Continue with other files
          }
        }
        
        if (loadedSources.length === 0) {
          // Fallback to silent demo track if no files could be loaded
          const sampleRate = audioContext.sampleRate;
          const duration = 10;
          const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
          const data = buffer.getChannelData(0);
          
          for (let i = 0; i < data.length; i++) {
            data[i] = 0; // Silent track
          }
          
          loadedSources.push({
            name: 'Demo Track (Silent)',
            audioBuffer: buffer,
            id: 'demo-track-silent',
          });
        }
        
        // Create a dummy source node (will be replaced when playing)
        const sourceNode = audioContext.createBufferSource();
        
        // Use the first loaded source as the initial selection
        const firstSource = loadedSources[0];
        sourceNode.buffer = firstSource.audioBuffer;
        sourceNode.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Update the store state with all loaded sources and enhanced audio system
        const syncEngine = getSyncEngine();
        const audioController = getAudioController(audioContext);
        
        set({
          audioSources: loadedSources,
          audioPlayer: {
            audioContext,
            sourceNode,
            gainNode,
            suspended: audioContext.state === 'suspended',
            syncEngine,
            audioController
          },
          downloadedAudioIds: new Set(loadedSources.map(source => source.id)),
          duration: firstSource.audioBuffer?.duration || 0,
          selectedAudioId: firstSource.id,
          isInitingSystem: false,
        });
        
      } catch (audioLoadError) {
        
        // Fallback to silent demo track
        const sampleRate = audioContext.sampleRate;
        const duration = 10;
        const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
          data[i] = 0;
        }
        
        const fallbackSource = {
          name: 'Demo Track (Fallback)',
          audioBuffer: buffer,
          id: 'demo-track-fallback',
        };
        
        const sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = fallbackSource.audioBuffer;
        sourceNode.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        set({
          audioSources: [fallbackSource],
          audioPlayer: {
            audioContext,
            sourceNode,
            gainNode,
            suspended: false,
          },
          downloadedAudioIds: new Set(['demo-track-fallback']),
          duration: fallbackSource.audioBuffer.duration,
          selectedAudioId: fallbackSource.id,
          isInitingSystem: false,
        });
      }
      
    } catch (error) {
      
      // Set initialization as complete even on error to prevent infinite loading
      set({ 
        isInitingSystem: false,
        audioSources: [], // Empty array to indicate no audio available
      });
      
      // Show user-friendly error message
      try {
        if (typeof toast !== 'undefined') {
          toast.error("Failed to initialize audio system. Please refresh the page and try again.");
        }
      } catch (toastError) {
        // Silent fallback
      }
    }
  };

  // Client-side initialization - called after component mount
  if (typeof window !== 'undefined') {
    // Safari/iOS specific setup
    if (window.navigator?.audioSession) {
      try {
        window.navigator.audioSession.type = 'playback';
      } catch (e) {
        // Ignore if not available
      }
    }

    // Initialize audio system with a slight delay to ensure DOM is ready
    setTimeout(() => {
      const state = get();
      if (state.audioSources.length === 0 && !state.isInitingSystem) {
        initializeAudio();
      }
    }, 100);
  }

  return {
    // Initialize with initialState
    ...initialState,

    // Initialize method for client-side initialization
    initializeAudio,

    // Method to resume audio context (for handling browser autoplay restrictions)
    resumeAudioContext: async () => {
      const state = get();
      if (state.audioPlayer?.audioContext) {
        const { audioContext } = state.audioPlayer;
        
        // Check multiple suspended states (Safari can have different states)
        if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
          try {
            await audioContext.resume();
            
            // Safari-specific: Re-create gain node if needed
            if (!state.audioPlayer.gainNode || state.audioPlayer.gainNode.context !== audioContext) {
              const gainNode = audioContext.createGain();
              gainNode.gain.value = state.volume || 0.5;
              gainNode.connect(audioContext.destination);
              
              set({
                audioPlayer: {
                  ...state.audioPlayer,
                  gainNode,
                  suspended: false,
                }
              });
            }
            
            // Update the audio sources to remove the requiresUserInteraction flag
            const updatedAudioSources = state.audioSources.map(source => ({
              ...source,
              requiresUserInteraction: false,
            }));
            
            // Update the store to mark audio as no longer suspended
            set({
              audioSources: updatedAudioSources,
              audioPlayer: {
                ...state.audioPlayer,
                suspended: false,
              },
            });
            
            return true; // Successfully resumed
            
          } catch (error) {
            // Safari fallback: Try to create a new audio context
            try {
              const newAudioContext = initializeAudioContext();
              if (newAudioContext.state === 'running') {
                const gainNode = newAudioContext.createGain();
                gainNode.gain.value = state.volume || 0.5;
                gainNode.connect(newAudioContext.destination);
                
                set({
                  audioPlayer: {
                    ...state.audioPlayer,
                    audioContext: newAudioContext,
                    gainNode,
                    suspended: false,
                  }
                });
                
                return true;
              }
            } catch (fallbackError) {
              // Silent fallback
            }
          }
        } else if (audioContext.state === 'running') {
          // Already running, just ensure proper state
          set({
            audioPlayer: {
              ...state.audioPlayer,
              suspended: false,
            }
          });
          return true;
        }
      }
      return false; // Failed to resume
    },

    // Audio control methods
    playAudio: ({ offset = 0, when = 0, audioIndex = 0 }) => {
      const state = get();
      
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
      const { audioContext } = state.audioPlayer || { audioContext: new (window.AudioContext || window.webkitAudioContext)() };

      try {
        const audioBuffer = await audioContext.decodeAudioData(source.audioBuffer);
        
        const newAudioSource = {
          name: source.name,
          audioBuffer,
          id: source.id,
        };

        set((state) => ({
          audioSources: [...state.audioSources, newAudioSource],
          ...(source.id === state.selectedAudioId ? { duration: audioBuffer.duration } : {}),
        }));

        state.markAudioAsDownloaded(source.id);
        state.addToUploadHistory(source.name, source.id);
      } catch (error) {
        // Failed to decode audio data
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
      
      // Calculate quality level based on metrics
      let qualityLevel = 'unknown';
      if (newQuality.latency > 0) {
        if (newQuality.latency < 50 && newQuality.jitter < 10 && newQuality.accuracy > 0.95) {
          qualityLevel = 'excellent';
        } else if (newQuality.latency < 100 && newQuality.jitter < 20 && newQuality.accuracy > 0.9) {
          qualityLevel = 'good';
        } else if (newQuality.latency < 200 && newQuality.jitter < 50 && newQuality.accuracy > 0.8) {
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
        const accuracy = Math.max(0, 1 - (maxLatency - minLatency) / avgLatency);
        
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
          accuracy,
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
        state.playAudio({ when: 0, offset: trackTimeSeconds || 0 });
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

    // Reset function
    resetStore: () => {
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

      // Reset audio-related state but keep room and sync state
      set({
        audioSources: [],
        selectedAudioId: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        playbackStartTime: 0,
        playbackOffset: 0,
        audioPlayer: null,
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
  };
});
