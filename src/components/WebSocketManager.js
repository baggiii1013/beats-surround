'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
    ClientActionTypes,
    ScheduledActionTypes,
    ServerActionTypes,
    calculateOffsetEstimate,
    epochNow,
    handleNTPResponse,
    sendWSRequest
} from '../lib/websocket';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';

const MAX_NTP_MEASUREMENTS = 40;
const WS_RECONNECT_DELAY = 3000;
const NTP_REQUEST_INTERVAL = 30;

export default function WebSocketManager() {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const ntpIntervalRef = useRef(null);
  
  // Room state
  const roomId = useRoomStore((state) => state.roomId);
  const username = useRoomStore((state) => state.username);
  const userId = useRoomStore((state) => state.userId);
  const setUserId = useRoomStore((state) => state.setUserId);
  
  // Global state
  const setSocket = useGlobalStore((state) => state.setSocket);
  const setConnectedClients = useGlobalStore((state) => state.setConnectedClients);
  const setSelectedAudioId = useGlobalStore((state) => state.setSelectedAudioId);
  const broadcastPlay = useGlobalStore((state) => state.broadcastPlay);
  const broadcastPause = useGlobalStore((state) => state.broadcastPause);
  
  // NTP synchronization state
  const ntpMeasurements = useGlobalStore((state) => state.ntpMeasurements);
  const setNtpMeasurements = useGlobalStore((state) => state.setNtpMeasurements);
  const offsetEstimate = useGlobalStore((state) => state.offsetEstimate);
  const setOffsetEstimate = useGlobalStore((state) => state.setOffsetEstimate);
  const setRoundTripEstimate = useGlobalStore((state) => state.setRoundTripEstimate);
  const isSynced = useGlobalStore((state) => state.isSynced);
  const setIsSynced = useGlobalStore((state) => state.setIsSynced);
  
  // Audio control functions
  const schedulePlay = useGlobalStore((state) => state.schedulePlay);
  const schedulePause = useGlobalStore((state) => state.schedulePause);
  const processSpatialConfig = useGlobalStore((state) => state.processSpatialConfig);
  const addAudioSource = useGlobalStore((state) => state.addAudioSource);
  
  const connectWebSocket = () => {
    // Ensure we have both roomId and username
    const effectiveUsername = username || `User_${Math.random().toString(36).substring(2, 5)}`;
    
    if (!roomId || !effectiveUsername) {
      return;
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    const wsUrl = `ws://localhost:8080/ws?roomId=${roomId}&username=${encodeURIComponent(effectiveUsername)}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setSocket(ws);
      
      ws.onopen = () => {
        toast.success('Connected to room');
        
        // Clear any reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // Start NTP synchronization
        startNTPSync();
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (error) {
          // Error parsing WebSocket message - silently ignore
        }
      };
      
      ws.onclose = (event) => {
        setSocket(null);
        setIsSynced(false);
        
        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000) { // Not normal closure
          toast.error('Connection lost, attempting to reconnect...');
          scheduleReconnect();
        }
      };
      
      ws.onerror = (error) => {
        toast.error(`Connection error: ${error.message || 'Network error'}`);
      };
      
    } catch (error) {
      toast.error(`Failed to connect: ${error.message}`);
      scheduleReconnect();
    }
  };
  
  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) return; // Already scheduled
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      connectWebSocket();
    }, WS_RECONNECT_DELAY);
  };
  
  const startNTPSync = () => {
    if (!wsRef.current || ntpIntervalRef.current) return;
    
    // Send initial NTP request
    sendNTPRequest();
    
    // Schedule subsequent requests
    ntpIntervalRef.current = setInterval(() => {
      if (ntpMeasurements.length < MAX_NTP_MEASUREMENTS) {
        sendNTPRequest();
      } else {
        // Stop sending requests once we have enough measurements
        clearInterval(ntpIntervalRef.current);
        ntpIntervalRef.current = null;
      }
    }, NTP_REQUEST_INTERVAL);
  };
  
  const sendNTPRequest = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    const t0 = epochNow();
    sendWSRequest({
      ws: wsRef.current,
      request: {
        type: ClientActionTypes.NTP_REQUEST,
        t0
      }
    });
  };
  
  const handleServerMessage = (message) => {
    switch (message.type) {
      case ServerActionTypes.CONNECTION_ESTABLISHED:
        handleConnectionEstablished(message);
        break;
        
      case ServerActionTypes.NTP_RESPONSE:
        handleNTPResponseMessage(message);
        break;
        
      case ServerActionTypes.SCHEDULED_ACTION:
        handleScheduledAction(message);
        break;
        
      case ServerActionTypes.CLIENT_UPDATE:
        setConnectedClients(message.clients);
        break;
        
      case ServerActionTypes.TRACK_CHANGE:
        handleTrackChange(message);
        break;
        
      case ServerActionTypes.NEW_AUDIO_SOURCE:
        handleNewAudioSource(message);
        break;
        
      default:
        // Unknown message type - silently ignore
    }
  };
  
  const handleConnectionEstablished = (message) => {
    setUserId(message.clientId);
    setConnectedClients(message.roomInfo.clients);
    
    // Sync with room state if there's ongoing playback
    if (message.roomInfo.currentTrack) {
      setSelectedAudioId(message.roomInfo.currentTrack);
    }
  };
  
  const handleNTPResponseMessage = (message) => {
    const measurement = handleNTPResponse(message);
    const newMeasurements = [...ntpMeasurements, measurement];
    setNtpMeasurements(newMeasurements);
    
    // Calculate running estimates
    const { averageOffset, averageRoundTrip } = calculateOffsetEstimate(newMeasurements);
    setOffsetEstimate(averageOffset);
    setRoundTripEstimate(averageRoundTrip);
    
    // Mark as synced when we have enough measurements
    if (newMeasurements.length >= MAX_NTP_MEASUREMENTS) {
      setIsSynced(true);
      toast.success(`Synchronized (±${Math.round(averageRoundTrip)}ms)`);
    }
  };
  
  const handleScheduledAction = (message) => {
    const { scheduledAction, serverTimeToExecute } = message;
    
    switch (scheduledAction.type) {
      case ScheduledActionTypes.PLAY:
        schedulePlay({
          trackTimeSeconds: scheduledAction.trackTimeSeconds,
          targetServerTime: serverTimeToExecute,
          audioId: scheduledAction.audioId
        });
        break;
        
      case ScheduledActionTypes.PAUSE:
        schedulePause({
          targetServerTime: serverTimeToExecute
        });
        break;
        
      case ScheduledActionTypes.SPATIAL_CONFIG:
        processSpatialConfig({
          listeningSource: scheduledAction.listeningSource,
          gains: scheduledAction.gains
        });
        break;
        
      case ScheduledActionTypes.SPATIAL_CONFIG_STOP:
        // Handle spatial audio stop
        useGlobalStore.getState().processStopSpatialAudio();
        break;
        
      default:
        // Unknown scheduled action - silently ignore
    }
  };
  
  const handleTrackChange = (message) => {
    setSelectedAudioId(message.audioId);
    toast.info(`Track changed by ${message.clientId}`);
  };
  
  const handleNewAudioSource = async (message) => {
    try {
      const { audioId, audioName, audioBuffer } = message;
      
      // Convert received audio buffer to proper format
      const arrayBuffer = new Uint8Array(audioBuffer).buffer;
      
      const audioSource = {
        name: audioName,
        audioBuffer: arrayBuffer,
        id: audioId,
      };
      
      // Add to global store
      await addAudioSource(audioSource);
      
      toast.success(`New audio: ${audioName}`);
    } catch (error) {
      toast.error('Failed to load shared audio');
    }
  };
  
  // Connect when component mounts and room info is available
  useEffect(() => {
    
    if (roomId && username) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        connectWebSocket();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [roomId, username]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000); // Normal closure
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ntpIntervalRef.current) {
        clearInterval(ntpIntervalRef.current);
      }
    };
  }, []);
  
  // Enhanced global store methods for WebSocket integration
  useEffect(() => {
    const originalBroadcastPlay = useGlobalStore.getState().broadcastPlay;
    const originalBroadcastPause = useGlobalStore.getState().broadcastPause;
    
    // Override broadcast methods to use WebSocket
    useGlobalStore.setState({
      broadcastPlay: (trackTimeSeconds = 0) => {
        const selectedAudioId = useGlobalStore.getState().selectedAudioId;
        if (!wsRef.current || !selectedAudioId) return;
        
        sendWSRequest({
          ws: wsRef.current,
          request: {
            type: ClientActionTypes.PLAY,
            trackTimeSeconds,
            audioId: selectedAudioId
          }
        });
      },
      
      broadcastPause: () => {
        if (!wsRef.current) return;
        
        sendWSRequest({
          ws: wsRef.current,
          request: {
            type: ClientActionTypes.PAUSE
          }
        });
      },
      
      // Add new WebSocket-specific methods
      broadcastTrackChange: (audioId, trackInfo) => {
        if (!wsRef.current) return;
        
        sendWSRequest({
          ws: wsRef.current,
          request: {
            type: ClientActionTypes.SET_TRACK,
            audioId,
            trackInfo
          }
        });
      },
      
      broadcastPositionChange: (position) => {
        if (!wsRef.current) return;
        
        sendWSRequest({
          ws: wsRef.current,
          request: {
            type: ClientActionTypes.SET_POSITION,
            position
          }
        });
      },
      
      broadcastSpatialAudioStart: () => {
        if (!wsRef.current) return;
        
        sendWSRequest({
          ws: wsRef.current,
          request: {
            type: ClientActionTypes.SPATIAL_AUDIO_START
          }
        });
      },
      
      broadcastSpatialAudioStop: () => {
        if (!wsRef.current) return;
        
        sendWSRequest({
          ws: wsRef.current,
          request: {
            type: ClientActionTypes.SPATIAL_AUDIO_STOP
          }
        });
      },
      
      broadcastListeningSource: (x, y) => {
        if (!wsRef.current) return;
        
        sendWSRequest({
          ws: wsRef.current,
          request: {
            type: ClientActionTypes.SET_LISTENING_SOURCE,
            x,
            y
          }
        });
      }
    });
  }, []);
  
  return null; // This component doesn't render anything
}
