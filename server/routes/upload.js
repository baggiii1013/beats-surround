const {
  generatePresignedUploadUrl,
  getPublicAudioUrl,
  generateAudioFileName,
  validateR2Config,
  validateAudioFileExists
} = require('../lib/r2');

/**
 * Handle request for presigned upload URL
 * POST /api/upload-url
 */
const handleGetPresignedURL = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validate R2 configuration first
    const r2Validation = validateR2Config();
    if (!r2Validation.isValid) {
      return res.status(500).json({ 
        error: 'R2 configuration not complete',
        details: r2Validation.errors 
      });
    }

    const { roomId, fileName, contentType } = req.body;

    // Validate required fields
    if (!roomId || !fileName || !contentType) {
      return res.status(400).json({ 
        error: 'Missing required fields: roomId, fileName, contentType' 
      });
    }

    // Validate content type is audio
    if (!contentType.startsWith('audio/')) {
      return res.status(400).json({ 
        error: 'Content type must be an audio mime type' 
      });
    }

    // Check if room exists (you might want to implement this check)
    // const room = rooms.get(roomId);
    // if (!room) {
    //   return res.status(404).json({ 
    //     error: 'Room not found. Please join the room before uploading files.' 
    //   });
    // }

    // Generate unique filename
    const uniqueFileName = generateAudioFileName(fileName);
    const r2Key = `room-${roomId}/${uniqueFileName}`;

    // Generate presigned URL for upload
    const uploadUrl = await generatePresignedUploadUrl(
      roomId,
      uniqueFileName,
      contentType
    );
    const publicUrl = getPublicAudioUrl(roomId, uniqueFileName);

    res.json({
      uploadUrl,
      publicUrl,
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

/**
 * Handle upload completion notification
 * POST /api/upload-complete
 */
const handleUploadComplete = (rooms, wss) => async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { roomId, originalName, publicUrl, metadata } = req.body;

    // Validate required fields
    if (!roomId || !originalName || !publicUrl) {
      return res.status(400).json({ 
        error: 'Missing required fields: roomId, originalName, publicUrl' 
      });
    }

    // Check if room exists
    const room = rooms.get(roomId);
    if (!room) {
      return res.status(404).json({ 
        error: 'Room not found. The room may have been closed during upload.' 
      });
    }

    // Validate that the file actually exists in R2
    const fileExists = await validateAudioFileExists(publicUrl);
    if (!fileExists) {
      return res.status(400).json({ 
        error: 'File validation failed. Please try uploading again.' 
      });
    }

    // Add audio source to room with metadata
    const audioSource = {
      url: publicUrl,
      name: metadata?.title || originalName.replace(/\.[^/.]+$/, ''), // Use metadata title or fallback to filename
      id: publicUrl, // Use URL as ID for R2 files
      uploadedAt: new Date().toISOString(),
      type: 'r2-upload',
      // Include metadata if available
      ...(metadata && {
        artist: metadata.artist,
        album: metadata.album,
        albumArtist: metadata.albumArtist,
        year: metadata.year,
        genre: metadata.genre,
        duration: metadata.duration,
        coverArt: metadata.coverArt,
        metadata: metadata
      })
    };

    // Store in room's audio sources
    if (!room.audioSources) {
      room.audioSources = new Map();
    }
    room.audioSources.set(audioSource.id, audioSource);

    // Broadcast to all clients in the room
    const message = {
      type: 'NEW_AUDIO_SOURCE_R2',
      audioSource: audioSource
    };

    // Send to all clients in the room
    if (room.clients) {
      room.clients.forEach(client => {
        if (client.ws && client.ws.readyState === 1) { // WebSocket.OPEN
          client.ws.send(JSON.stringify(message));
        }
      });
    }

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm upload' });
  }
};

/**
 * Handle audio file requests (redirect to R2)
 * POST /api/audio
 */
const handleGetAudio = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Missing required field: id' });
    }

    // For R2 files, the ID is the public URL, so just redirect
    if (id.startsWith('http')) {
      return res.redirect(302, id);
    }

    // Legacy format: "room-{roomId}/{fileName}"
    const parts = id.split('/');
    if (parts.length !== 2 || !parts[0].startsWith('room-')) {
      return res.status(400).json({ error: 'Invalid file ID format' });
    }

    const roomId = parts[0].substring(5); // Remove "room-" prefix
    const fileName = parts[1];

    // Generate R2 public URL and redirect
    const publicUrl = getPublicAudioUrl(roomId, fileName);
    
    res.redirect(302, publicUrl);

  } catch (error) {
    res.status(500).json({ error: 'Failed to process audio request' });
  }
};

module.exports = {
  handleGetPresignedURL,
  handleUploadComplete,
  handleGetAudio
};
