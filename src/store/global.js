import { toast } from 'sonner';
import { create } from 'zustand';
import { createPlaceholderCoverArt, extractAudioMetadata } from '../lib/audioMetadata';

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

const loadAudioSourceUrl = async ({ url, audioContext }) => {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  
  // Extract metadata (including cover art) before decoding audio
  const metadata = await extractAudioMetadata(arrayBuffer, url);
  
  // Decode audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice());
  
  return {
    name: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    albumArtist: metadata.albumArtist,
    year: metadata.year,
    genre: metadata.genre,
    coverArt: metadata.coverArt || createPlaceholderCoverArt(metadata.title, metadata.artist),
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
  
  const audioContext = new AudioContextClass();
  
  return audioContext;
};

const fetchDefaultAudioSources = async () => {
  // Return demo audio sources from public/audio directory
  // Names will be extracted from metadata
  return [
    { url: '/audio/Sia%20-%20Cheap%20Thrills%20(Performance%20Edit).flac' },
    { url: '/audio/Cheap%20Thrills%20feat%20Sean%20Paul%20-%20Sia%20Sean%20Paul%20.flac' },
    { url: '/audio/Sunflower%20-%20Spider-Man%20Into%20the%20Spider-Verse%20-%20Post%20Malone%20Swae%20Lee%20.flac' },
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
              audioContext 
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
        
        // Update the store state with all loaded sources
        set({
          audioSources: loadedSources,
          audioPlayer: {
            audioContext,
            sourceNode,
            gainNode,
            suspended: audioContext.state === 'suspended',
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
        if (audioContext.state === 'suspended') {
          try {
            await audioContext.resume();
            
            // Update the audio sources to remove the requiresUserInteraction flag
            const updatedAudioSources = state.audioSources.map(source => ({
              ...source,
              requiresUserInteraction: false, // Remove the user interaction requirement
            }));
            
            // Update the store to mark audio as no longer suspended
            set({
              audioSources: updatedAudioSources,
              audioPlayer: {
                ...state.audioPlayer,
                suspended: false,
              },
            });
            
          } catch (error) {
            // Failed to resume AudioContext
          }
        }
      }
    },

    // Audio control methods
    playAudio: ({ offset = 0, when = 0, audioIndex = 0 }) => {
      const state = get();
      const { sourceNode, audioContext, gainNode } = getAudioPlayer(state);

      // Before any audio playback, ensure the context is running
      if (audioContext.state !== "running") {
        toast.error("Audio context is suspended. Please try again.");
        return;
      }

      // Stop any existing source node before creating a new one
      try {
        sourceNode.stop();
      } catch (_) {}

      const startTime = audioContext.currentTime + when;
      const audioBuffer = state.audioSources[audioIndex].audioBuffer;

      // Create a new source node
      const newSourceNode = audioContext.createBufferSource();
      newSourceNode.buffer = audioBuffer;
      newSourceNode.connect(gainNode);

      // Handle track ending
      newSourceNode.onended = () => {
        const currentState = get();
        if (currentState.isPlaying) {
          // Auto-skip to next track
          currentState.skipToNextTrack(true);
        }
      };

      // Start playback
      newSourceNode.start(startTime, offset);

      // Update player state
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
      const { sourceNode, audioContext } = getAudioPlayer(state);

      const stopTime = audioContext.currentTime + when;
      
      try {
        sourceNode.stop(stopTime);
      } catch (error) {
        // Failed to stop audio source
      }

      set({ isPlaying: false });
    },

    // Track selection and management
    setSelectedAudioId: (audioId) => {
      const state = get();
      const wasPlaying = state.isPlaying;

      // Stop current playback
      if (wasPlaying) {
        try {
          state.audioPlayer?.sourceNode.stop();
        } catch (_) {}
      }

      // Find the selected audio source
      const selectedSource = state.audioSources.find(source => source.id === audioId);
      
      set({ 
        selectedAudioId: audioId,
        isPlaying: false,
        currentTime: 0,
        duration: selectedSource ? selectedSource.audioBuffer.duration : 0,
      });

      return !wasPlaying; // Return true if it was NOT playing before
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
        } while (nextIndex === currentIndex);
      } else {
        nextIndex = (currentIndex + 1) % audioSources.length;
      }

      const nextAudioId = audioSources[nextIndex].id;
      const wasPlaying = state.setSelectedAudioId(nextAudioId);

      if (wasPlaying || isAutoplay) {
        setTimeout(() => {
          state.broadcastPlay(0);
        }, 100);
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
      const wasPlaying = state.setSelectedAudioId(prevAudioId);

      if (wasPlaying) {
        setTimeout(() => {
          state.broadcastPlay(0);
        }, 100);
      }
    },

    toggleShuffle: () => set((state) => ({ isShuffled: !state.isShuffled })),

    // Current time tracking
    getCurrentTrackPosition: () => {
      const state = get();
      if (!state.isPlaying || !state.audioPlayer) return state.currentTime;
      
      const { audioContext } = state.audioPlayer;
      const elapsed = audioContext.currentTime - state.playbackStartTime;
      return state.playbackOffset + elapsed;
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

    // Upload tracking
    addToUploadHistory: (name, id) =>
      set((state) => ({
        uploadHistory: [...state.uploadHistory, { name, timestamp: Date.now(), id }],
      })),

    hasDownloadedAudio: (id) => {
      const state = get();
      return state.downloadedAudioIds.has(id);
    },

    markAudioAsDownloaded: (id) => {
      set((state) => {
        const newSet = new Set(state.downloadedAudioIds);
        newSet.add(id);
        return { downloadedAudioIds: newSet };
      });
    },

    // System state
    setIsInitingSystem: async (isIniting) => {
      if (!isIniting) {
        const state = get();
        const audioContext = state.audioPlayer?.audioContext;
        if (audioContext && audioContext.state === "suspended") {
          try {
            await audioContext.resume();
          } catch (err) {
            // Failed to resume AudioContext
          }
        }
      }
      set({ isInitingSystem: isIniting });
    },

    // Spatial audio
    setIsSpatialAudioEnabled: (isEnabled) => set({ isSpatialAudioEnabled: isEnabled }),
    
    updateListeningSource: ({ x, y }) => {
      set({ listeningSourcePosition: { x, y } });
    },

    setIsDraggingListeningSource: (isDragging) => set({ isDraggingListeningSource: isDragging }),

    // Connected clients
    setConnectedClients: (clients) => set({ connectedClients: clients }),

    // Socket management
    setSocket: (socket) => set({ socket }),

    // WebSocket synchronization methods
    setNtpMeasurements: (measurements) => set({ ntpMeasurements: measurements }),
    setOffsetEstimate: (offset) => set({ offsetEstimate: offset }),
    setRoundTripEstimate: (roundTrip) => set({ roundTripEstimate: roundTrip }),
    setIsSynced: (synced) => set({ isSynced: synced }),

    // Scheduled audio actions for synchronization
    schedulePlay: ({ trackTimeSeconds, targetServerTime, audioId }) => {
      const state = get();
      if (state.isInitingSystem) {
        return;
      }

      const waitTimeSeconds = getWaitTimeSeconds(state, targetServerTime);

      // Update selected audio if different
      if (audioId !== state.selectedAudioId) {
        set({ selectedAudioId: audioId });
      }

      // Find the audio source
      const audioSource = state.audioSources.find(source => source.id === audioId);
      if (!audioSource) {
        toast.error('Audio file not found');
        return;
      }

      // Schedule the play action
      setTimeout(() => {
        try {
          state.playAudio({
            offset: trackTimeSeconds,
            when: 0,
            audioBuffer: audioSource.audioBuffer
          });
        } catch (error) {
          // Error playing scheduled audio - silently ignore
        }
      }, waitTimeSeconds * 1000);
    },

    schedulePause: ({ targetServerTime }) => {
      const state = get();
      const waitTimeSeconds = getWaitTimeSeconds(state, targetServerTime);

      setTimeout(() => {
        try {
          state.pauseAudio({ when: 0 });
        } catch (error) {
          // Error pausing scheduled audio - silently ignore
        }
      }, waitTimeSeconds * 1000);
    },

    // Process spatial audio configuration from server
    processSpatialConfig: (config) => {
      const state = get();
      set({ spatialConfig: config });
      const { gains, listeningSource } = config;

      // Update listening source position if not dragging
      if (!state.isDraggingListeningSource) {
        set({ listeningSourcePosition: listeningSource });
      }

      // Apply gain changes if we have an audio player
      if (state.audioPlayer) {
        const { gainNode, audioContext } = state.audioPlayer;
        
        // For now, apply a simple gain based on average of all clients
        // In a real implementation, you'd use the specific client's gain
        const gainValues = Object.values(gains);
        if (gainValues.length > 0) {
          const averageGain = gainValues.reduce((sum, g) => sum + g.gain, 0) / gainValues.length;
          const rampTime = gainValues[0]?.rampTime || 0.25;
          
          const now = audioContext.currentTime;
          gainNode.gain.cancelScheduledValues(now);
          gainNode.gain.setValueAtTime(gainNode.gain.value, now);
          gainNode.gain.linearRampToValueAtTime(averageGain, now + rampTime);
        }
      }
    },

    processStopSpatialAudio: () => {
      const state = get();
      if (state.audioPlayer) {
        const { gainNode, audioContext } = state.audioPlayer;
        const now = audioContext.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(1.0, now + 0.25);
      }
      set({ 
        isSpatialAudioEnabled: false,
        spatialConfig: null 
      });
    },

    // Enhanced playAudio method for WebSocket synchronization
    playAudio: ({ offset, when, audioBuffer }) => {
      const state = get();
      const { audioPlayer } = state;
      
      if (!audioPlayer || !audioBuffer) {
        return;
      }

      const { audioContext, gainNode } = audioPlayer;

      // Stop any existing source
      if (audioPlayer.sourceNode) {
        try {
          audioPlayer.sourceNode.stop();
        } catch (e) {
          // Ignore if already stopped
        }
      }

      // Create new source node
      const sourceNode = audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Schedule playback
      const startTime = audioContext.currentTime + when;
      sourceNode.start(startTime, offset);

      // Handle track ending
      sourceNode.onended = () => {
        const currentState = get();
        if (currentState.isPlaying && currentState.audioPlayer?.sourceNode === sourceNode) {
          // Auto-skip to next track or stop
          currentState.skipToNextTrack(true);
        }
      };

      // Update state
      set({
        audioPlayer: {
          ...audioPlayer,
          sourceNode
        },
        isPlaying: true,
        currentTime: offset,
        playbackStartTime: startTime,
        playbackOffset: offset,
        duration: audioBuffer.duration
      });
    },

    pauseAudio: ({ when }) => {
      const state = get();
      const { audioPlayer } = state;
      
      if (!audioPlayer?.sourceNode) {
        return;
      }

      const { sourceNode, audioContext } = audioPlayer;
      const stopTime = audioContext.currentTime + when;
      
      try {
        sourceNode.stop(stopTime);
      } catch (e) {
        // Error stopping audio source - silently ignore
      }

      // Calculate current position
      const elapsedSinceStart = stopTime - state.playbackStartTime;
      const currentTrackPosition = state.playbackOffset + elapsedSinceStart;

      set({
        isPlaying: false,
        currentTime: Math.max(0, currentTrackPosition)
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

      if (state.isPlaying && state.audioPlayer) {
        try {
          state.audioPlayer.sourceNode.stop();
        } catch (e) {
          // Ignore errors if already stopped
        }
      }

      if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.close();
      }

      if (state.audioPlayer?.audioContext) {
        state.audioPlayer.audioContext.close().catch(() => {});
      }

      set(initialState);
      initializeAudio();
    },

    // Volume control
    getCurrentGainValue: () => {
      const state = get();
      if (!state.audioPlayer) return 1;
      return state.audioPlayer.gainNode.gain.value;
    },
  };
});
