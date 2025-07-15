const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sanitize = require('sanitize-filename');

// R2 Configuration - environment variables should already be loaded by main server
const S3_CONFIG = {
  BUCKET_NAME: process.env.S3_BUCKET_NAME,
  PUBLIC_URL: process.env.S3_PUBLIC_URL,
  ENDPOINT: process.env.S3_ENDPOINT,
  ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
};

// Validate required environment variables
// const requiredEnvVars = ['S3_BUCKET_NAME', 'S3_PUBLIC_URL', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
// const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

// if (missingEnvVars.length > 0) {
//   console.warn(`Missing R2 environment variables: ${missingEnvVars.join(', ')}`);
//   console.warn('R2 functionality will be limited');
// } else {
//   console.log('R2 configuration loaded successfully');
//   console.log('R2 Bucket:', S3_CONFIG.BUCKET_NAME);
//   console.log('R2 Endpoint:', S3_CONFIG.ENDPOINT);
// }



// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: S3_CONFIG.ENDPOINT,
  credentials: {
    accessKeyId: S3_CONFIG.ACCESS_KEY_ID,
    secretAccessKey: S3_CONFIG.SECRET_ACCESS_KEY,
  },
});

/**
 * Generate a presigned URL for uploading audio files to R2
 */
async function generatePresignedUploadUrl(
  roomId,
  fileName,
  contentType,
  expiresIn = 3600 // 1 hour
) {
  const key = `room-${roomId}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: S3_CONFIG.BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    Metadata: {
      roomId,
      uploadedAt: new Date().toISOString(),
    },
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Get the public URL for an audio file
 */
function getPublicAudioUrl(roomId, fileName) {
  return `${S3_CONFIG.PUBLIC_URL}/room-${roomId}/${fileName}`;
}

/**
 * Generate a unique file name for audio uploads
 */
function generateAudioFileName(originalName) {
  // Extract extension
  const extension = originalName.split('.').pop() || 'mp3';

  // Remove extension from name for processing
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');

  // Remove slashes from the original name
  const nameWithoutSlashes = nameWithoutExt.replace(/[\/\\]/g, '-');

  // Sanitize filename using the library
  let safeName = sanitize(nameWithoutSlashes, { replacement: '-' });

  // Truncate if too long (leave room for timestamp and extension)
  const maxNameLength = 100;
  if (safeName.length > maxNameLength) {
    safeName = safeName.substring(0, maxNameLength);
  }

  // Fallback if name becomes empty after sanitization
  if (!safeName) {
    safeName = 'audio';
  }

  // Generate timestamp with date and random component
  const now = new Date();
  const timestamp = now.getTime();
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  return `${safeName}__${timestamp}_${randomSuffix}.${extension}`;
}

/**
 * Validate R2 configuration
 */
function validateR2Config() {
  const errors = [];
  
  if (!S3_CONFIG.BUCKET_NAME) errors.push('S3_BUCKET_NAME not set');
  if (!S3_CONFIG.PUBLIC_URL) errors.push('S3_PUBLIC_URL not set');
  if (!S3_CONFIG.ENDPOINT) errors.push('S3_ENDPOINT not set');
  if (!S3_CONFIG.ACCESS_KEY_ID) errors.push('S3_ACCESS_KEY_ID not set');
  if (!S3_CONFIG.SECRET_ACCESS_KEY) errors.push('S3_SECRET_ACCESS_KEY not set');

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate if an audio file exists in R2
 */
async function validateAudioFileExists(audioUrl) {
  try {
    // Extract the key from the public URL
    const urlPath = audioUrl.replace(S3_CONFIG.PUBLIC_URL, '');
    const key = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;

    // Perform HEAD request to check if object exists
    const command = new HeadObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    return true; // File exists
  } catch (error) {
    return false;
  }
}

/**
 * List objects with a specific prefix (for cleanup/management)
 */
async function listObjectsWithPrefix(prefix) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Prefix: prefix,
    });

    const response = await r2Client.send(command);
    
    return response.Contents || [];
  } catch (error) {
    return [];
  }
}

/**
 * Delete multiple objects (for cleanup)
 */
async function deleteObjects(keys) {
  try {
    const objects = keys.map(key => ({ Key: key }));
    
    const command = new DeleteObjectsCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Delete: {
        Objects: objects,
      },
    });

    await r2Client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Delete multiple objects with batch optimization
 */
async function deleteObjectsWithPrefix(prefix) {
  try {
    const objects = await listObjectsWithPrefix(prefix);
    
    if (!objects || objects.length === 0) {
      console.log(`No objects found with prefix "${prefix}"`);
      return { deletedCount: 0 };
    }

    const objectsToDelete = objects.map(obj => ({ Key: obj.Key }));
    let deletedCount = 0;

    // Delete in batches of 1000 (AWS S3/R2 limit)
    const batchSize = 1000;
    for (let i = 0; i < objectsToDelete.length; i += batchSize) {
      const batch = objectsToDelete.slice(i, i + batchSize);

      const command = new DeleteObjectsCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Delete: {
          Objects: batch,
          Quiet: true, // Only return errors, not successful deletions
        },
      });

      const response = await r2Client.send(command);
      
      // Count successful deletions (total batch size minus errors)
      const batchDeletedCount = batch.length - (response.Errors?.length || 0);
      deletedCount += batchDeletedCount;

      // Log any errors
      if (response.Errors && response.Errors.length > 0) {
        response.Errors.forEach(error => {
          console.error(`Failed to delete ${error.Key}: ${error.Message}`);
        });
      }
    }

    return { deletedCount };
  } catch (error) {
    console.error(`Failed to delete objects with prefix "${prefix}":`, error);
    throw error;
  }
}

/**
 * Clean up orphaned rooms that exist in R2 but not in active server rooms
 */
async function cleanupOrphanedRooms(activeRoomIds, performDeletion = false) {
  const result = {
    orphanedRooms: [],
    totalRooms: 0,
    totalFiles: 0,
    deletedFiles: 0,
    errors: []
  };

  try {
    // Validate R2 configuration first
    const r2Config = validateR2Config();
    if (!r2Config.isValid) {
      throw new Error(`R2 configuration is invalid: ${r2Config.errors.join(', ')}`);
    }

    // Get all room objects from R2
    const roomObjects = await listObjectsWithPrefix('room-');
    
    if (!roomObjects || roomObjects.length === 0) {
      console.log('No room objects found in R2');
      return result;
    }

    console.log(`Found ${roomObjects.length} room objects in R2`);

    // Group objects by room
    const roomsInR2 = new Map();
    roomObjects.forEach(obj => {
      if (obj.Key) {
        const match = obj.Key.match(/^room-([^\/]+)\//);
        if (match) {
          const roomId = match[1];
          if (!roomsInR2.has(roomId)) {
            roomsInR2.set(roomId, []);
          }
          roomsInR2.get(roomId).push(obj.Key);
        }
      }
    });

    console.log(`Found ${roomsInR2.size} unique rooms in R2`);
    console.log(`Found ${activeRoomIds.size} active rooms in server memory`);

    // Identify orphaned rooms
    const orphanedRooms = [];
    roomsInR2.forEach((files, roomId) => {
      if (!activeRoomIds.has(roomId)) {
        orphanedRooms.push({
          roomId,
          fileCount: files.length,
          files: files
        });
        result.totalFiles += files.length;
      }
    });

    result.totalRooms = orphanedRooms.length;
    result.orphanedRooms = orphanedRooms.map(room => ({
      roomId: room.roomId,
      fileCount: room.fileCount
    }));

    if (orphanedRooms.length === 0) {
      return result;
    }

    if (!performDeletion) {
      return result;
    }

    // Delete orphaned rooms
    let totalDeleted = 0;
    for (const orphanedRoom of orphanedRooms) {
      try {
        const deleteResult = await deleteObjectsWithPrefix(`room-${orphanedRoom.roomId}`);
        totalDeleted += deleteResult.deletedCount;
      } catch (error) {
        const errorMsg = `Failed to delete room-${orphanedRoom.roomId}: ${error.message}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    result.deletedFiles = totalDeleted;

    return result;
  } catch (error) {
    console.error('Orphaned room cleanup failed:', error);
    throw error;
  }
}

module.exports = {
  generatePresignedUploadUrl,
  getPublicAudioUrl,
  generateAudioFileName,
  validateR2Config,
  validateAudioFileExists,
  listObjectsWithPrefix,
  deleteObjects,
  deleteObjectsWithPrefix,
  cleanupOrphanedRooms,
  r2Client,
  S3_CONFIG
};
