// R2 Upload API functions
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * Upload audio file using Cloudflare R2 (3-step process)
 */
export const uploadAudioFileR2 = async ({ file, roomId, metadata = null }) => {
  try {
    // Step 1: Get presigned upload URL from server
    const uploadUrlResponse = await fetch(`${API_BASE_URL}/api/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomId,
        fileName: file.name,
        contentType: file.type,
      }),
    });

    if (!uploadUrlResponse.ok) {
      const error = await uploadUrlResponse.json();
      throw new Error(error.error || 'Failed to get upload URL');
    }

    const { uploadUrl, publicUrl } = await uploadUrlResponse.json();

    // Step 2: Upload directly to R2 using presigned URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    // Step 3: Notify server that upload completed successfully
    const completeResponse = await fetch(`${API_BASE_URL}/api/upload-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomId,
        originalName: file.name,
        publicUrl,
        metadata, // Include extracted metadata
      }),
    });

    if (!completeResponse.ok) {
      const error = await completeResponse.json();
      throw new Error(error.error || 'Failed to complete upload');
    }

    return {
      success: true,
      publicUrl,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Fetch audio file (now handles R2 URLs directly)
 */
export const fetchAudioFile = async (url) => {
  try {
    // For R2 files, fetch directly from the public URL
    if (url.startsWith('http')) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }
      return await response.blob();
    }

    // Fallback for legacy file IDs
    const response = await fetch(`${API_BASE_URL}/api/audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: url }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    throw error;
  }
};

/**
 * Fetch default/demo audio files from R2
 */
export const fetchDefaultAudioFiles = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/default-audio`);

    if (!response.ok) {
      return [];
    }

    const audioFiles = await response.json();
    return audioFiles;
  } catch (error) {
    return [];
  }
};

/**
 * Fetch room-specific audio files from R2
 */
export const fetchRoomAudioFiles = async (roomId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/room-audio/${roomId}`);

    if (!response.ok) {
      return [];
    }

    const audioFiles = await response.json();
    return audioFiles;
  } catch (error) {
    return [];
  }
};

/**
 * Legacy upload function (keeping for backward compatibility)
 */
export const uploadAudioFile = async ({ file, roomId }) => {
  // Use R2 upload by default
  return uploadAudioFileR2({ file, roomId });
};
