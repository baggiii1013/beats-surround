// Enhanced server-side upload handling with chunked support
// Add this to your server/index.js

// Enhanced room class with better audio storage
class EnhancedRoom {
  constructor(id) {
    this.id = id;
    this.clients = new Map();
    this.audioSources = new Map();
    this.chunkBuffers = new Map(); // For handling chunked uploads
    this.isPlaying = false;
    this.currentTrack = null;
    this.playbackStartTime = null;
    this.trackPosition = 0;
    this.listeningSource = { x: 50, y: 50 };
    this.spatialAudioEnabled = false;
    this.created = epochNow();
    this.lastActivity = epochNow();
  }

  // Enhanced audio source handling
  addAudioSource(audioId, audioData) {
    const audioSource = {
      id: audioId,
      name: audioData.audioName,
      audioBuffer: audioData.audioBuffer,
      uploadedBy: audioData.uploadedBy,
      uploadedAt: epochNow(),
      metadata: audioData.metadata || {},
      size: audioData.audioBuffer ? audioData.audioBuffer.length : 0
    };
    
    this.audioSources.set(audioId, audioSource);
    this.lastActivity = epochNow();
    
    return audioSource;
  }

  // Get audio sources summary (without large buffers)
  getAudioSourcesSummary() {
    const sources = [];
    for (const [id, source] of this.audioSources) {
      sources.push({
        id: source.id,
        name: source.name,
        uploadedBy: source.uploadedBy,
        uploadedAt: source.uploadedAt,
        metadata: source.metadata,
        size: source.size
      });
    }
    return sources;
  }

  // Handle chunked upload start
  startChunkedUpload(audioId, metadata) {
    this.chunkBuffers.set(audioId, {
      chunks: new Array(metadata.totalChunks),
      receivedChunks: 0,
      totalChunks: metadata.totalChunks,
      audioName: metadata.audioName,
      metadata: metadata.metadata,
      uploadedBy: metadata.uploadedBy,
      startTime: epochNow()
    });
  }

  // Handle chunk reception
  addChunk(audioId, chunkIndex, chunkData) {
    const buffer = this.chunkBuffers.get(audioId);
    if (!buffer) {
      return false;
    }

    buffer.chunks[chunkIndex] = chunkData;
    buffer.receivedChunks++;

    return buffer.receivedChunks === buffer.totalChunks;
  }

  // Complete chunked upload
  completeChunkedUpload(audioId) {
    const buffer = this.chunkBuffers.get(audioId);
    if (!buffer || buffer.receivedChunks !== buffer.totalChunks) {
      return null;
    }

    // Combine all chunks
    const totalLength = buffer.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedBuffer = new Array(totalLength);
    let offset = 0;

    for (const chunk of buffer.chunks) {
      for (let i = 0; i < chunk.length; i++) {
        combinedBuffer[offset + i] = chunk[i];
      }
      offset += chunk.length;
    }

    // Create complete audio source
    const audioSource = this.addAudioSource(audioId, {
      audioName: buffer.audioName,
      audioBuffer: combinedBuffer,
      uploadedBy: buffer.uploadedBy,
      metadata: buffer.metadata
    });

    // Clean up chunk buffer
    this.chunkBuffers.delete(audioId);

    return audioSource;
  }

  // Clean up incomplete uploads older than 5 minutes
  cleanupStaleUploads() {
    const now = epochNow();
    const TIMEOUT = 5 * 60 * 1000; // 5 minutes

    for (const [audioId, buffer] of this.chunkBuffers) {
      if (now - buffer.startTime > TIMEOUT) {
        this.chunkBuffers.delete(audioId);
      }
    }
  }
}

// Enhanced message handlers
const handleAudioUploadStart = (room, data, clientId) => {
  
  room.startChunkedUpload(data.audioId, {
    totalChunks: data.totalChunks,
    audioName: data.audioName,
    metadata: data.metadata,
    uploadedBy: clientId
  });

  // Send acknowledgment
  const client = room.clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify({
      type: 'UPLOAD_ACK',
      audioId: data.audioId,
      status: 'started'
    }));
  }
};

const handleAudioUploadChunk = (room, data, clientId) => {
  const isComplete = room.addChunk(data.audioId, data.chunkIndex, data.chunk);
  
  if (isComplete) {
    
    const audioSource = room.completeChunkedUpload(data.audioId);
    if (audioSource) {
      // Broadcast to all clients except uploader
      const message = {
        type: 'NEW_AUDIO_SOURCE',
        audioId: audioSource.id,
        audioName: audioSource.name,
        audioBuffer: audioSource.audioBuffer,
        uploadedBy: audioSource.uploadedBy,
        metadata: audioSource.metadata
      };
      
      room.broadcast(message, clientId);

      // Send completion confirmation to uploader
      const client = room.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'UPLOAD_COMPLETE',
          audioId: data.audioId,
          status: 'success'
        }));
      }
    }
  }
};

const handleAudioUploadComplete = (room, data, clientId) => {
  // This is called when client confirms all chunks were sent
  // The actual completion logic is in handleAudioUploadChunk
};

// Enhanced audio upload handler (replace existing one)
const handleAudioUpload = (room, data, clientId) => {
  // Store audio source in room with enhanced metadata
  const audioSource = room.addAudioSource(data.audioId, {
    audioName: data.audioName,
    audioBuffer: data.audioBuffer,
    uploadedBy: clientId,
    metadata: data.metadata || {}
  });
  
  const message = {
    type: 'NEW_AUDIO_SOURCE',
    audioId: audioSource.id,
    audioName: audioSource.name,
    audioBuffer: audioSource.audioBuffer,
    uploadedBy: audioSource.uploadedBy,
    metadata: audioSource.metadata
  };
  
  room.broadcast(message, clientId); // Exclude the uploader
};

// Add these to your message handler switch statement:
/*
case 'UPLOAD_AUDIO_START':
  handleAudioUploadStart(room, data, clientId);
  break;

case 'UPLOAD_AUDIO_CHUNK':
  handleAudioUploadChunk(room, data, clientId);
  break;

case 'UPLOAD_AUDIO_COMPLETE':
  handleAudioUploadComplete(room, data, clientId);
  break;
*/

// Cleanup task - add this to run periodically
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.cleanupStaleUploads) {
      room.cleanupStaleUploads();
    }
  }
}, 60000); // Run every minute
