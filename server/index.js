const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv')
const app = express();
const server = http.createServer(app);

dotenv.config();

// Optimize HTTP server for low latency
server.keepAliveTimeout = 5000;
server.headersTimeout = 6000;
server.timeout = 10000;

// Enable CORS for all routes
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [ 'https://beats-surround.vercel.app'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '50mb' }));

// WebSocket server with ultra-low latency optimizations
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
  perMessageDeflate: false, // Disable compression for lower latency
  maxPayload: 50 * 1024 * 1024, // 50MB max payload
  clientTracking: true,
  handleProtocols: () => false // Disable protocol negotiation
});

// Room management
const rooms = new Map();
const clients = new Map();

// Timing configuration - Ultra low latency
const SCHEDULE_TIME_MS = 50; // Reduced from 750ms to 50ms for ultra-low latency
const MAX_NTP_MEASUREMENTS = 10; // Reduced for faster NTP sync
const SPATIAL_UPDATE_INTERVAL = 16; // 60fps updates (16ms) instead of 100ms
const MESSAGE_BATCH_SIZE = 10; // Batch messages for efficiency
const HIGH_FREQUENCY_MODE = true; // Enable high frequency optimizations

// Utility functions
const epochNow = () => {
  // Use high-resolution time for sub-millisecond precision
  const hrTime = process.hrtime.bigint();
  return Number(hrTime / 1000000n); // Convert nanoseconds to milliseconds
};

const calculateWaitTimeMilliseconds = (targetServerTime, offsetEstimate) => {
  const now = epochNow();
  const serverNow = now + offsetEstimate;
  return Math.max(0, targetServerTime - serverNow);
};

const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Message queue for batching
class MessageQueue {
  constructor() {
    this.queue = new Map(); // clientId -> messages[]
    this.processingId = null;
  }

  add(clientId, message) {
    if (!this.queue.has(clientId)) {
      this.queue.set(clientId, []);
    }
    this.queue.get(clientId).push(message);
    
    // Schedule immediate processing in high frequency mode
    if (HIGH_FREQUENCY_MODE && !this.processingId) {
      this.processingId = setImmediate(() => this.flush());
    }
  }

  flush() {
    this.processingId = null;
    for (const [clientId, messages] of this.queue) {
      if (messages.length > 0) {
        // Find client and send batched messages
        for (const [ws, clientData] of clients) {
          if (clientData.clientId === clientId && ws.readyState === WebSocket.OPEN) {
            // Send all messages immediately
            messages.forEach(msg => ws.send(msg));
            break;
          }
        }
        messages.length = 0; // Clear processed messages
      }
    }
  }
}

const messageQueue = new MessageQueue();

// Room class to manage room state
class Room {
  constructor(id) {
    this.id = id;
    this.clients = new Map();
    this.currentTrack = null;
    this.isPlaying = false;
    this.playbackStartTime = 0;
    this.trackPosition = 0;
    this.spatialConfig = null;
    this.listeningSource = { x: 50, y: 50 };
    this.intervalId = null;
    this.createdAt = Date.now();
    this.audioSources = new Map(); // Store room's audio sources
  }

  addClient(clientId, client) {
    this.clients.set(clientId, client);
    
    // Send current room state to new client
    this.sendRoomStateToClient(client);
    
    // Position clients in circle
    this.positionClientsInCircle();
    
    // Broadcast updated client list
    this.broadcast({
      type: 'CLIENT_UPDATE',
      clients: this.getClientsList()
    });
  }

  removeClient(clientId) {
    this.clients.delete(clientId);
    
    // Clean up room if empty
    if (this.clients.size === 0) {
      this.cleanup();
      rooms.delete(this.id);
    } else {
      // Reposition remaining clients
      this.positionClientsInCircle();
      
      // Broadcast updated client list
      this.broadcast({
        type: 'CLIENT_UPDATE',
        clients: this.getClientsList()
      });
    }
  }

  positionClientsInCircle() {
    const clients = Array.from(this.clients.values());
    const centerX = 50;
    const centerY = 50;
    const radius = 25;
    
    clients.forEach((client, index) => {
      const angle = (index * 2 * Math.PI) / clients.length;
      client.position = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });
  }

  sendRoomStateToClient(client) {
    // Send current track if playing
    if (this.currentTrack && this.isPlaying) {
      const currentTime = epochNow();
      const elapsedTime = (currentTime - this.playbackStartTime) / 1000;
      const currentPosition = this.trackPosition + elapsedTime;
      
      client.ws.send(JSON.stringify({
        type: 'SCHEDULED_ACTION',
        serverTimeToExecute: currentTime + SCHEDULE_TIME_MS,
        scheduledAction: {
          type: 'PLAY',
          audioId: this.currentTrack,
          trackTimeSeconds: Math.max(0, currentPosition)
        }
      }));
    }
    
    // Send existing audio sources
    this.audioSources.forEach((source, id) => {
      client.ws.send(JSON.stringify({
        type: 'NEW_AUDIO_SOURCE',
        audioId: id,
        audioName: source.name,
        audioBuffer: source.audioBuffer
      }));
    });
  }

  cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  broadcast(message, excludeClientId = null) {
    const messageStr = JSON.stringify(message);
    
    if (HIGH_FREQUENCY_MODE) {
      // Ultra-low latency: send immediately without queuing
      this.clients.forEach((client, clientId) => {
        if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
          // Use setImmediate for non-blocking send
          setImmediate(() => {
            try {
              client.ws.send(messageStr);
            } catch (error) {
              // Handle send errors silently
            }
          });
        }
      });
    } else {
      // Standard broadcast
      this.clients.forEach((client, clientId) => {
        if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(messageStr);
        }
      });
    }
  }

  getClientsList() {
    return Array.from(this.clients.values()).map(client => ({
      clientId: client.clientId,
      username: client.username,
      position: client.position,
      isActive: client.isActive,
      rtt: client.rtt || 0
    }));
  }
}

// Message handlers
const handleMessage = (ws, message, clientData) => {
  const t1 = epochNow();
  
  try {
    const data = JSON.parse(message);
    const { roomId, clientId } = clientData;
    const room = rooms.get(roomId);
    
    if (!room) {
      return;
    }

    switch (data.type) {
      case 'NTP_REQUEST':
        handleNTPRequest(ws, data, t1);
        break;

      case 'PLAY':
        handlePlayRequest(room, data);
        break;

      case 'PAUSE':
        handlePauseRequest(room);
        break;

      case 'SET_TRACK':
        handleSetTrack(room, data, clientId);
        break;

      case 'SET_POSITION':
        handleSetPosition(room, data, clientId);
        break;

      case 'SPATIAL_AUDIO_START':
        handleSpatialAudioStart(room);
        break;

      case 'SPATIAL_AUDIO_STOP':
        handleSpatialAudioStop(room);
        break;

      case 'SET_LISTENING_SOURCE':
        handleSetListeningSource(room, data);
        break;

      case 'UPLOAD_AUDIO':
        handleAudioUpload(room, data, clientId);
        break;

      default:
        // Unknown message type - silently ignore
    }
  } catch (error) {
    // Error handling message - silently ignore
  }
};

const handleNTPRequest = (ws, data, t1) => {
  const t2 = epochNow(); // High-precision timestamp
  const response = {
    type: 'NTP_RESPONSE',
    t0: data.t0,
    t1: t1,
    t2: t2
  };
  
  // Send immediately without any delay
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(response));
  }
};

const handlePlayRequest = (room, data) => {
  const message = {
    type: 'SCHEDULED_ACTION',
    scheduledAction: {
      type: 'PLAY',
      trackTimeSeconds: data.trackTimeSeconds || 0,
      audioId: data.audioId
    },
    serverTimeToExecute: epochNow() + SCHEDULE_TIME_MS
  };
  
  room.isPlaying = true;
  room.currentTrack = data.audioId;
  room.playbackStartTime = message.serverTimeToExecute;
  room.trackPosition = data.trackTimeSeconds || 0;
  
  room.broadcast(message);
};

const handlePauseRequest = (room) => {
  const message = {
    type: 'SCHEDULED_ACTION',
    scheduledAction: {
      type: 'PAUSE'
    },
    serverTimeToExecute: epochNow() + SCHEDULE_TIME_MS
  };
  
  room.isPlaying = false;
  
  room.broadcast(message);
};

const handleSetTrack = (room, data, clientId) => {
  const message = {
    type: 'TRACK_CHANGE',
    audioId: data.audioId,
    trackInfo: data.trackInfo,
    clientId: clientId
  };
  
  room.currentTrack = data.audioId;
  room.broadcast(message);
};

const handleSetPosition = (room, data, clientId) => {
  const client = room.clients.get(clientId);
  if (client) {
    client.position = data.position;
    
    // Broadcast updated client list
    const message = {
      type: 'CLIENT_UPDATE',
      clients: room.getClientsList()
    };
    room.broadcast(message);
  }
};

const handleSpatialAudioStart = (room) => {
  if (room.intervalId) return; // Already running
  
  // Start ultra-high frequency spatial audio updates
  let loopCount = 0;
  room.intervalId = setInterval(() => {
    updateSpatialAudio(room, loopCount);
    loopCount++;
  }, SPATIAL_UPDATE_INTERVAL); // 60fps updates for smooth spatial audio
};

const handleSpatialAudioStop = (room) => {
  if (room.intervalId) {
    clearInterval(room.intervalId);
    room.intervalId = null;
  }
  
  const message = {
    type: 'SCHEDULED_ACTION',
    scheduledAction: {
      type: 'SPATIAL_CONFIG_STOP'
    },
    serverTimeToExecute: epochNow()
  };
  
  room.broadcast(message);
};

const handleSetListeningSource = (room, data) => {
  room.listeningSource = { x: data.x, y: data.y };
};

const handleAudioUpload = (room, data, clientId) => {
  // Store audio source in room
  room.audioSources.set(data.audioId, {
    name: data.audioName,
    audioBuffer: data.audioBuffer,
    uploadedBy: clientId,
    uploadedAt: epochNow()
  });
  
  const message = {
    type: 'NEW_AUDIO_SOURCE',
    audioId: data.audioId,
    audioName: data.audioName,
    audioBuffer: data.audioBuffer,
    uploadedBy: clientId
  };
  
  room.broadcast(message, clientId); // Exclude the uploader
};

const updateSpatialAudio = (room, loopCount) => {
  const clientsList = room.getClientsList();
  
  if (clientsList.length === 0) return;
  
  // Calculate gains based on distance from listening source
  const gains = {};
  
  clientsList.forEach(client => {
    const distance = Math.sqrt(
      Math.pow(client.position.x - room.listeningSource.x, 2) + 
      Math.pow(client.position.y - room.listeningSource.y, 2)
    );
    
    // Convert distance to gain (closer = louder)
    const maxDistance = 100; // Assuming 100x100 grid
    const normalizedDistance = Math.min(distance / maxDistance, 1);
    const gain = Math.max(0.1, 1 - normalizedDistance);
    
    gains[client.clientId] = {
      gain: gain,
      rampTime: 0.016 // Ultra-smooth 16ms ramp time for 60fps
    };
  });
  
  const message = {
    type: 'SCHEDULED_ACTION',
    scheduledAction: {
      type: 'SPATIAL_CONFIG',
      listeningSource: room.listeningSource,
      gains: gains
    },
    serverTimeToExecute: epochNow() + SPATIAL_UPDATE_INTERVAL // Minimal delay
  };
  
  room.broadcast(message);
};

// WebSocket connection handling with ultra-low latency optimizations
wss.on('connection', (ws, req) => {
  // Optimize WebSocket for low latency
  ws._socket.setNoDelay(true); // Disable Nagle's algorithm
  ws._socket.setKeepAlive(true, 30000); // Keep connection alive
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('roomId');
  const username = url.searchParams.get('username');
  const clientId = uuidv4();
  
  // Get or create room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Room(roomId));
  }
  
  const room = rooms.get(roomId);
  
  // Create client data
  const clientData = {
    clientId,
    username,
    roomId,
    ws,
    position: { x: 50, y: 50 },
    isActive: true,
    rtt: 0
  };
  
  // Add client to room and global clients map
  room.addClient(clientId, clientData);
  clients.set(ws, clientData);
  
  // Send client their ID and room info immediately
  const connectionMessage = JSON.stringify({
    type: 'CONNECTION_ESTABLISHED',
    clientId: clientId,
    roomId: roomId,
    roomInfo: {
      currentTrack: room.currentTrack,
      isPlaying: room.isPlaying,
      trackPosition: room.trackPosition,
      clients: room.getClientsList()
    }
  });
  
  // Send immediately
  ws.send(connectionMessage);
  
  // Broadcast updated client list to room
  const clientUpdateMessage = {
    type: 'CLIENT_UPDATE',
    clients: room.getClientsList()
  };
  room.broadcast(clientUpdateMessage);
  
  // Handle messages with minimal overhead
  ws.on('message', (message) => {
    // Process immediately without any buffering
    setImmediate(() => handleMessage(ws, message, clientData));
  });
  
  // Handle disconnection
  ws.on('close', () => {
    const clientData = clients.get(ws);
    if (clientData) {
      const room = rooms.get(clientData.roomId);
      if (room) {
        room.removeClient(clientData.clientId);
        
        // Broadcast updated client list
        if (room.clients.size > 0) {
          const clientUpdateMessage = {
            type: 'CLIENT_UPDATE',
            clients: room.getClientsList()
          };
          room.broadcast(clientUpdateMessage);
        }
      }
      clients.delete(ws);
    }
  });
  
  ws.on('error', (error) => {
    // WebSocket error - silently ignore
  });
});

// REST API endpoints
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    roomId: room.id,
    clientCount: room.clients.size,
    isPlaying: room.isPlaying,
    currentTrack: room.currentTrack,
    createdAt: room.createdAt,
    hasAudio: room.audioSources.size > 0
  });
});

app.post('/api/rooms', (req, res) => {
  const roomId = generateRoomId();
  const room = new Room(roomId);
  rooms.set(roomId, room);
  
  res.json({
    roomId: roomId,
    created: true
  });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    roomId: room.id,
    clientCount: room.clients.size,
    isPlaying: room.isPlaying,
    createdAt: room.createdAt,
    hasAudio: room.audioSources.size > 0
  }));
  
  res.json(roomList);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    connections: clients.size
  });
});

const PORT = process.env.PORT || 8080;

// Configure server for ultra-low latency
server.listen(PORT, () => {
  // Optimize Node.js for low latency
  if (process.env.NODE_ENV === 'production') {
    // Production optimizations
    process.env.UV_THREADPOOL_SIZE = Math.max(4, require('os').cpus().length);
    
    // Set high priority for the process
    try {
      process.priority = -10; // High priority
    } catch (e) {
      // Ignore if unable to set priority
    }
  }
  
  // Start message queue flushing for high frequency mode
  if (HIGH_FREQUENCY_MODE) {
    setInterval(() => messageQueue.flush(), 1); // Flush every 1ms
  }
});

// Graceful shutdown with immediate cleanup
process.on('SIGTERM', () => {
  rooms.forEach(room => room.cleanup());
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});

// Additional low-latency optimizations
process.on('SIGINT', () => {
  rooms.forEach(room => room.cleanup());
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});
