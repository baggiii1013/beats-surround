# BeatsSurround 🎵 - Room Joining Update

## 🆕 New Features Added

### Multi-User Room System
- **Room Creation**: Automatically generates unique 6-character room IDs
- **Room Joining**: Users can join existing rooms by entering room IDs
- **Real-time Sync**: High-precision audio synchronization across all connected devices
- **Audio Sharing**: Upload audio files and share them with all room participants
- **Live Collaboration**: All playback controls are synchronized across devices

### WebSocket Implementation
- **NTP-inspired Time Sync**: Millisecond-accurate synchronization using Network Time Protocol algorithms
- **Room Management**: Server-side room state management with automatic cleanup
- **Real-time Events**: Live updates for user presence, audio sharing, and playback control
- **Connection Recovery**: Automatic reconnection with exponential backoff

## 🚀 Quick Start

### Start the Full Application
```bash
npm install
npm run dev:all
```

This starts:
- WebSocket server on `ws://localhost:8080/ws`
- Next.js client on `http://localhost:3000`

### Individual Services
```bash
# Start just the WebSocket server
npm run server

# Start just the Next.js client
npm run dev

# Development server with hot reload
npm run dev:server
```

## 🎵 How to Use Room Joining

### 1. Create a Room
- Open the app at `http://localhost:3000`
- A unique room ID is automatically generated (e.g., `ABC123`)
- Share this room ID with others

### 2. Join an Existing Room
- Click "Join Room" in the top-right panel
- Enter the room ID provided by another user
- You'll be connected and can see their audio library

### 3. Share Audio Files
- Upload audio files using drag-and-drop
- Files are automatically shared with all room participants
- Supported formats: MP3, WAV, FLAC, M4A

### 4. Synchronized Playback
- Play, pause, and seek controls work across all devices
- High-precision synchronization ensures minimal delay
- Real-time position updates keep everyone in sync

## 🔧 Technical Implementation

### WebSocket Events
- `NTP_REQUEST/NTP_RESPONSE`: Time synchronization
- `PLAY/PAUSE`: Synchronized playback control
- `UPLOAD_AUDIO`: Share audio files with room participants
- `CLIENT_UPDATE`: Real-time user presence updates
- `SPATIAL_CONFIG`: Spatial audio positioning

### Room Management API
- `GET /api/rooms/:roomId`: Check if room exists
- `POST /api/rooms`: Create new room
- `GET /api/rooms`: List all active rooms
- `GET /api/health`: Server health check

### Synchronization Algorithm
1. **NTP Sync**: Clients exchange timestamps to calculate clock offset
2. **Scheduled Actions**: All audio actions are scheduled with server time
3. **Buffering**: Commands are buffered to account for network latency
4. **Recovery**: Automatic resync when connections are restored

## 🎯 Testing the Room System

The app includes a development test component that shows:
- ✓ Room ID generation status
- ✓ WebSocket connection status  
- ✓ Time synchronization status
- ✓ Connected clients count

## 📡 WebSocket Connection Flow

1. **Connection**: Client connects with room ID and username
2. **Authentication**: Server validates room and assigns client ID
3. **Synchronization**: NTP-style time sync establishes baseline
4. **Room State**: Server sends current room state (playing track, position)
5. **Audio Sharing**: Any uploaded audio is broadcast to all clients
6. **Real-time Updates**: All actions are synchronized across clients

## 🛠️ Architecture

```
Client (React/Next.js)
    ↓ WebSocket
WebSocket Server (Node.js/Express)
    ↓ Room Management
Room State (In-Memory)
    ↓ Audio Buffers
Shared Audio Library
```

## 🚧 Development Notes

- Room IDs are 6-character alphanumeric codes
- Audio files are shared as ArrayBuffers over WebSocket
- All audio processing happens client-side for privacy
- NTP sync achieves ~50ms accuracy on local networks
- Server automatically cleans up empty rooms

---

**Multi-device synchronized music experience with room joining! 🎵**
