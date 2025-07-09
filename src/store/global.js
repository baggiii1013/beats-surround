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
  isInitingSystem: true,
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
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
  // Function to initialize or reinitialize audio system
  const initializeAudio = async () => {
    console.log("initializeAudio()");
    
    try {
      // Create fresh audio context
      const audioContext = initializeAudioContext();
      
      // Create master gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1; // Default volume
      const sourceNode = audioContext.createBufferSource();
      
      // For demo purposes, create a simple sine wave as default audio
      const sampleRate = audioContext.sampleRate;
      const duration = 30; // 30 seconds
      const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate a simple sine wave
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1;
      }
      
      const firstSource = {
        name: 'Demo Sine Wave',
        audioBuffer: buffer,
        id: 'demo-sine-wave',
      };
      
      sourceNode.buffer = firstSource.audioBuffer;
      sourceNode.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      set({
        audioSources: [firstSource],
        audioPlayer: {
          audioContext,
          sourceNode,
          gainNode,
        },
        downloadedAudioIds: new Set(['demo-sine-wave']),
        duration: firstSource.audioBuffer.duration,
        selectedAudioId: firstSource.id,
        isInitingSystem: false,
      });
      
      console.log("Audio system initialized with demo audio");
    } catch (error) {
      console.error("Failed to initialize audio:", error);
      set({ isInitingSystem: false });
    }
  };

  return {
    // Initialize with initialState
    ...initialState,

    // Initialize method for client-side initialization
    initializeAudio,

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
