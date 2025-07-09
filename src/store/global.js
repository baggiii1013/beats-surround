import { toast } from 'sonner';
import { create } from 'zustand';

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
  
  // Network and sync
  socket: null,
  offsetEstimate: 0,
  ntpMeasurements: [],
  
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
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return {
    name: extractDefaultFileName(url),
    audioBuffer,
    id: url,
  };
};

const initializeAudioContext = () => {
  console.log('initializeAudioContext called');
  
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    console.error('initializeAudioContext: Not in browser environment');
    throw new Error('AudioContext is not available in server-side environment');
  }
  
  // Try to create AudioContext with fallback for older browsers
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  
  if (!AudioContextClass) {
    console.error('initializeAudioContext: AudioContext not supported');
    throw new Error('AudioContext is not supported in this browser');
  }
  
  console.log('initializeAudioContext: Creating AudioContext');
  const audioContext = new AudioContextClass();
  
  console.log('initializeAudioContext: AudioContext created with state:', audioContext.state);
  
  return audioContext;
};

const fetchDefaultAudioSources = async () => {
  // Mock default audio sources - in real implementation, these would come from your server
  return [
    { url: '/audio/sample1.mp3', name: 'Sample Track 1' },
    { url: '/audio/sample2.mp3', name: 'Sample Track 2' },
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
  console.log('Global store created with initial state');
  
  // Add a timeout to prevent infinite loading
  setTimeout(() => {
    const state = get();
    if (state.isInitingSystem) {
      console.log('Timeout reached, forcing initialization to complete');
      set({ isInitingSystem: false });
    }
  }, 5000); // 5 second timeout (reduced from 15)
  
  // Function to initialize or reinitialize audio system
  const initializeAudio = async () => {
    console.log("initializeAudio() - Starting audio system initialization");
    
    try {
      // First, try to create a minimal audio context to test browser support
      let audioContext;
      
      try {
        audioContext = initializeAudioContext();
        console.log("AudioContext created successfully");
      } catch (audioContextError) {
        console.error("Failed to create AudioContext:", audioContextError);
        
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
        
        console.log("Initialized without audio context");
        return;
      }
      
      // Check if audioContext is suspended (common in modern browsers with autoplay restrictions)
      if (audioContext.state === 'suspended') {
        console.log("AudioContext is suspended due to autoplay restrictions");
        
        // For suspended context, we'll create the audio setup but mark it as needing user interaction
        const fallbackSource = {
          name: 'Click to Enable Audio',
          audioBuffer: null,
          id: 'suspended-audio',
          requiresUserInteraction: true,
        };
        
        set({
          audioSources: [fallbackSource],
          audioPlayer: {
            audioContext,
            sourceNode: null,
            gainNode: null,
            suspended: true,
          },
          downloadedAudioIds: new Set(['suspended-audio']),
          duration: 0,
          selectedAudioId: fallbackSource.id,
          isInitingSystem: false,
        });
        
        console.log("Audio system initialized but suspended due to autoplay restrictions");
        return;
      }
      
      // Create master gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1; // Default volume
      
      // Create a dummy source node (will be replaced when playing)
      const sourceNode = audioContext.createBufferSource();
      
      // Create a very simple demo buffer
      const sampleRate = audioContext.sampleRate;
      const duration = 10; // 10 seconds
      const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate silence for demo
      for (let i = 0; i < data.length; i++) {
        data[i] = 0; // Silent track
      }
      
      const firstSource = {
        name: 'Demo Track',
        audioBuffer: buffer,
        id: 'demo-track',
      };
      
      // Connect the audio nodes
      sourceNode.buffer = firstSource.audioBuffer;
      sourceNode.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Update the store state
      set({
        audioSources: [firstSource],
        audioPlayer: {
          audioContext,
          sourceNode,
          gainNode,
          suspended: false,
        },
        downloadedAudioIds: new Set(['demo-track']),
        duration: firstSource.audioBuffer.duration,
        selectedAudioId: firstSource.id,
        isInitingSystem: false,
      });
      
      console.log("Audio system initialized successfully");
      console.log("AudioContext state:", audioContext.state);
      
    } catch (error) {
      console.error("Failed to initialize audio:", error);
      
      // Set initialization as complete even on error to prevent infinite loading
      set({ 
        isInitingSystem: false,
        audioSources: [], // Empty array to indicate no audio available
      });
      
      // Show user-friendly error message
      try {
        if (typeof toast !== 'undefined') {
          toast.error("Failed to initialize audio system. Please refresh the page and try again.");
        } else {
          console.error("Toast not available, showing console error instead");
        }
      } catch (toastError) {
        console.error("Error showing toast:", toastError);
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
            console.log('AudioContext resumed successfully via user interaction');
            
            // If this was a suspended audio setup, reinitialize with proper audio
            if (state.audioPlayer.suspended) {
              // Create proper demo audio now that context is active
              const sampleRate = audioContext.sampleRate;
              const duration = 10;
              const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
              const data = buffer.getChannelData(0);
              
              // Generate silence for demo
              for (let i = 0; i < data.length; i++) {
                data[i] = 0;
              }
              
              const gainNode = audioContext.createGain();
              gainNode.gain.value = 1;
              const sourceNode = audioContext.createBufferSource();
              
              const audioSource = {
                name: 'Demo Track',
                audioBuffer: buffer,
                id: 'demo-track',
              };
              
              sourceNode.buffer = audioSource.audioBuffer;
              sourceNode.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
              // Update the store with the active audio setup
              set({
                audioSources: [audioSource],
                audioPlayer: {
                  audioContext,
                  sourceNode,
                  gainNode,
                  suspended: false,
                },
                downloadedAudioIds: new Set(['demo-track']),
                duration: audioSource.audioBuffer.duration,
                selectedAudioId: audioSource.id,
              });
              
              console.log('Audio system fully initialized after user interaction');
            }
          } catch (error) {
            console.error('Failed to resume AudioContext:', error);
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
        console.log("AudioContext still suspended, aborting play");
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
        console.warn("Failed to stop audio source:", error);
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
        console.error("Cannot broadcast play: No audio selected");
        return;
      }

      const audioIndex = state.findAudioIndexById(state.selectedAudioId);
      if (audioIndex === null) {
        console.error("Cannot play audio: No index found");
        return;
      }

      state.playAudio({
        offset: trackTimeSeconds || 0,
        when: 0,
        audioIndex,
      });
    },

    broadcastPause: () => {
      const state = get();
      state.pauseAudio({ when: 0 });
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
        console.error("Failed to decode audio data:", error);
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
            console.log("AudioContext resumed via user gesture");
          } catch (err) {
            console.warn("Failed to resume AudioContext", err);
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

    // Spatial audio actions (mock implementations)
    startSpatialAudio: () => {
      console.log("Starting spatial audio");
      set({ isSpatialAudioEnabled: true });
    },

    sendStopSpatialAudio: () => {
      console.log("Stopping spatial audio");
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
