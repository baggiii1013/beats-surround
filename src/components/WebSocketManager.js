'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { WS_URL } from '../config/websocket';
import {
  ClientActionTypes,
  ScheduledActionTypes,
  ServerActionTypes,
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
  const connectionQualityIntervalRef = useRef(null);
  
  // Room state
  const roomId = useRoomStore((state) => state.roomId);
  const username = useRoomStore((state) => state.username);
  const setUserId = useRoomStore((state) => state.setUserId);
  
  // Global state
  const setSocket = useGlobalStore((state) => state.setSocket);
  const setConnectedClients = useGlobalStore((state) => state.setConnectedClients);
  const setSelectedAudioId = useGlobalStore((state) => state.setSelectedAudioId);
  
  // Connection status tracking
  const setConnectionStatus = useGlobalStore((state) => state.setConnectionStatus);
  const updateConnectionMetrics = useGlobalStore((state) => state.updateConnectionMetrics);
  const connectionStatus = useGlobalStore((state) => state.connectionStatus);
  
  // NTP synchronization state
  const ntpMeasurements = useGlobalStore((state) => state.ntpMeasurements);
  const isSynced = useGlobalStore((state) => state.isSynced);
  const setIsSynced = useGlobalStore((state) => state.setIsSynced);
  
  // Sync quality functions
  const setSyncQuality = useGlobalStore((state) => state.setSyncQuality);
  const updateSyncQuality = useGlobalStore((state) => state.updateSyncQuality);
  const addNTPMeasurement = useGlobalStore((state) => state.addNTPMeasurement);
  
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
    
    // Close existing connection if it exists
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    const wsUrl = `${WS_URL}/ws?roomId=${roomId}&username=${encodeURIComponent(effectiveUsername)}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setSocket(ws);
      
      ws.onopen = () => {
        toast.success('Connected to room');
        
        // Update connection status
        setConnectionStatus({
          isConnected: true,
          connectionStartTime: Date.now(),
          reconnectCount: connectionStatus.reconnectCount || 0,
          lastReconnectTime: connectionStatus.reconnectCount > 0 ? Date.now() : 0
        });
        
        // Reset sync quality to unknown when connecting
        setSyncQuality({
          latency: 0,
          jitter: 0,
          accuracy: 0,
          clockDrift: 0,
          qualityLevel: 'unknown'
        });
        
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
          
          // Update message metrics
          updateConnectionMetrics({
            messagesReceived: (connectionStatus.messagesReceived || 0) + 1,
            bytesReceived: (connectionStatus.bytesReceived || 0) + event.data.length
          });
          
          // Log non-NTP messages for debugging
          if (message.type !== ServerActionTypes.NTP_RESPONSE) {
            // Silent for production
          }
          
          handleServerMessage(message);
        } catch (error) {
          // Silent error handling
        }
      };
      
      ws.onclose = (event) => {
        setSocket(null);
        setIsSynced(false);
        
        // Update connection status
        setConnectionStatus({
          isConnected: false,
          connectionStrength: 'unknown'
        });
        
        // Stop NTP sync
        if (ntpIntervalRef.current) {
          clearInterval(ntpIntervalRef.current);
          ntpIntervalRef.current = null;
        }
        
        // Stop connection quality monitoring
        if (connectionQualityIntervalRef.current) {
          clearInterval(connectionQualityIntervalRef.current);
          connectionQualityIntervalRef.current = null;
        }
        
        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000) { // Not normal closure
          toast.error('Connection lost, attempting to reconnect...');
          
          // Increment reconnect count
          setConnectionStatus({
            reconnectCount: (connectionStatus.reconnectCount || 0) + 1
          });
          
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
  
  // Enhanced send function that tracks metrics
  const trackingWSRequest = (requestData) => {
    const messageStr = JSON.stringify(requestData.request);
    
    // Update outgoing message metrics
    updateConnectionMetrics({
      messagesSent: (connectionStatus.messagesSent || 0) + 1,
      bytesSent: (connectionStatus.bytesSent || 0) + messageStr.length
    });
    
    // Track ping for NTP requests
    if (requestData.request.type === ClientActionTypes.NTP_REQUEST) {
      updateConnectionMetrics({
        lastPingTime: Date.now()
      });
    }
    
    return sendWSRequest(requestData);
  };
  
  const startNTPSync = () => {
    if (!wsRef.current || ntpIntervalRef.current) return;
    
    // Send initial NTP request immediately
    sendNTPRequest();
    
    // Schedule subsequent requests with exponential backoff
    let requestCount = 0;
    
    const scheduleNextRequest = () => {
      if (requestCount >= MAX_NTP_MEASUREMENTS) {
        return;
      }
      
      // Exponential backoff: start fast, then slow down
      const delay = requestCount < 5 ? NTP_REQUEST_INTERVAL : 
                   requestCount < 20 ? NTP_REQUEST_INTERVAL * 2 : 
                   NTP_REQUEST_INTERVAL * 4;
      
      ntpIntervalRef.current = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN && requestCount < MAX_NTP_MEASUREMENTS) {
          sendNTPRequest();
          requestCount++;
          scheduleNextRequest();
        }
      }, delay);
    };
    
    requestCount = 1; // We already sent the first request
    scheduleNextRequest();
    
    // Start connection quality monitoring
    startConnectionQualityMonitoring();
  };
  
  const startConnectionQualityMonitoring = () => {
    if (connectionQualityIntervalRef.current) {
      clearInterval(connectionQualityIntervalRef.current);
    }
    
    connectionQualityIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        updateConnectionMetrics({
          uptime: connectionStatus.connectionStartTime ? 
            Date.now() - connectionStatus.connectionStartTime : 0
        });
      }
    }, 5000); // Update every 5 seconds
  };
  
  const sendNTPRequest = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const t0 = epochNow();
    
    try {
      trackingWSRequest({
        ws: wsRef.current,
        request: {
          type: ClientActionTypes.NTP_REQUEST,
          t0
        }
      });
    } catch (error) {
      // Silent error handling
    }
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
    
    // Use the store's addNTPMeasurement function which handles sync quality
    addNTPMeasurement(measurement);
    
    // Update connection metrics with ping information
    updateConnectionMetrics({
      ping: measurement.roundTripDelay,
      lastPingTime: Date.now()
    });
    
    // Show sync quality feedback when first synced
    if (ntpMeasurements.length + 1 === 10) { // First time reaching sync threshold
      const rtt = measurement.roundTripDelay;
      if (rtt < 100) {
        toast.success(`Synchronized (±${Math.round(rtt)}ms) - Excellent`);
      } else if (rtt < 250) {
        toast.success(`Synchronized (±${Math.round(rtt)}ms) - Good`);
      } else {
        toast.warning(`Synchronized (±${Math.round(rtt)}ms) - High latency`);
      }
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
        // Unknown scheduled action type
        break;
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
    // Override broadcast methods to use WebSocket
    useGlobalStore.setState({
      broadcastPlay: (trackTimeSeconds = 0) => {
        const selectedAudioId = useGlobalStore.getState().selectedAudioId;
        if (!wsRef.current || !selectedAudioId) return;
        
        trackingWSRequest({
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
        
        trackingWSRequest({
          ws: wsRef.current,
          request: {
            type: ClientActionTypes.PAUSE
          }
        });
      },
      
      // Add new WebSocket-specific methods
      broadcastTrackChange: (audioId, trackInfo) => {
        if (!wsRef.current) return;
        
        trackingWSRequest({
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
        
        trackingWSRequest({
          ws: wsRef.current,
          request: {
            type: ClientActionTypes.SET_POSITION,
            position
          }
        });
      },
      
      broadcastSpatialAudioStart: () => {
        if (!wsRef.current) return;
        
        trackingWSRequest({
          ws: wsRef.current,
          request: {
            type: ClientActionTypes.SPATIAL_AUDIO_START
          }
        });
      },
      
      broadcastSpatialAudioStop: () => {
        if (!wsRef.current) return;
        
        trackingWSRequest({
          ws: wsRef.current,
          request: {
            type: ClientActionTypes.SPATIAL_AUDIO_STOP
          }
        });
      },
      
      broadcastListeningSource: (x, y) => {
        if (!wsRef.current) return;
        
        trackingWSRequest({
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
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ntpIntervalRef.current) {
        clearInterval(ntpIntervalRef.current);
      }
      if (connectionQualityIntervalRef.current) {
        clearInterval(connectionQualityIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  return null; // This component doesn't render anything
}
