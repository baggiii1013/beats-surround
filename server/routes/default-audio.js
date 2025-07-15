const { listObjectsWithPrefix, S3_CONFIG } = require('../lib/r2');

/**
 * Handle request for default/demo audio files from R2
 * GET /api/default-audio
 */
const handleGetDefaultAudio = async (req, res) => {
  try {
    // List all objects in the root of the bucket (no prefix)
    // This will get all files that are not in room-specific folders
    const allObjects = await listObjectsWithPrefix("");

    if (!allObjects || allObjects.length === 0) {
      return res.json([]);
    }

    // Filter for audio files in root (not in room-xxx/ folders) and exclude non-audio files
    const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg'];
    const rootAudioFiles = allObjects.filter(obj => {
      // Skip files in room folders
      if (obj.Key.startsWith('room-')) {
        return false;
      }
      
      // Only include audio files
      const extension = obj.Key.toLowerCase().substring(obj.Key.lastIndexOf('.'));
      return audioExtensions.includes(extension);
    });

    // Map to array of audio sources with public URLs
    const audioSources = rootAudioFiles.map((obj) => ({
      url: `${S3_CONFIG.PUBLIC_URL}/${obj.Key}`,
      name: obj.Key.replace(/\.[^/.]+$/, ''), // Remove file extension
      id: `${S3_CONFIG.PUBLIC_URL}/${obj.Key}`, // Use URL as ID for R2 files
      size: obj.Size,
      lastModified: obj.LastModified,
      type: 'default-r2'
    }));

    res.json(audioSources);

  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch default audio files',
      details: error.message 
    });
  }
};

/**
 * Handle request for room-specific audio files from R2
 * GET /api/room-audio/:roomId
 */
const handleGetRoomAudio = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    // List all objects with "room-{roomId}/" prefix
    const objects = await listObjectsWithPrefix(`room-${roomId}/`);

    if (!objects || objects.length === 0) {
      return res.json([]);
    }

    // Map to array of audio sources
    const audioSources = objects.map((obj) => ({
      url: `${S3_CONFIG.PUBLIC_URL}/${obj.Key}`,
      name: obj.Key.replace(`room-${roomId}/`, '').split('__')[0], // Extract original name
      id: `${S3_CONFIG.PUBLIC_URL}/${obj.Key}`,
      size: obj.Size,
      lastModified: obj.LastModified,
      roomId: roomId,
      type: 'room-r2'
    }));

    res.json(audioSources);

  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch room audio files',
      details: error.message 
    });
  }
};

module.exports = {
  handleGetDefaultAudio,
  handleGetRoomAudio
};
