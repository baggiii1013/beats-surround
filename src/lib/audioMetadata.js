import { parseBuffer } from 'music-metadata';

/**
 * Extract metadata from an audio file buffer
 * @param {ArrayBuffer} arrayBuffer - The audio file buffer
 * @param {string} url - The original URL for fallback naming
 * @returns {Promise<Object>} - Metadata object with title, artist, album, cover art, etc.
 */
export async function extractAudioMetadata(arrayBuffer, url) {
  try {
    // Parse metadata from the audio buffer
    const metadata = await parseBuffer(new Uint8Array(arrayBuffer), 'audio/flac');
    
    const { common, format } = metadata;
    
    // Extract cover art
    let coverArt = null;
    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      const blob = new Blob([picture.data], { type: picture.format });
      coverArt = URL.createObjectURL(blob);
    }
    
    // Extract song information
    const title = common.title || extractTitleFromUrl(url);
    const artist = common.artist || 'Unknown Artist';
    const album = common.album || 'Unknown Album';
    const albumArtist = common.albumartist || artist;
    const year = common.year || null;
    const genre = common.genre && common.genre.length > 0 ? common.genre.join(', ') : null;
    const duration = format.duration || null;
    
    return {
      title,
      artist,
      album,
      albumArtist,
      year,
      genre,
      duration,
      coverArt,
      // Keep original data for debugging
      originalMetadata: metadata
    };
  } catch (error) {
    console.warn('Failed to extract metadata:', error);
    
    // Fallback to filename-based extraction
    return extractMetadataFromFilename(url);
  }
}

/**
 * Extract metadata from filename when audio metadata parsing fails
 * @param {string} url - The audio file URL
 * @returns {Object} - Basic metadata object
 */
function extractMetadataFromFilename(url) {
  const filename = decodeURIComponent(url.split('/').pop().replace(/\.[^/.]+$/, ''));
  
  // Try to parse common filename patterns
  // Pattern: "Artist - Song Title"
  let artist = 'Unknown Artist';
  let title = filename;
  
  if (filename.includes(' - ')) {
    const parts = filename.split(' - ');
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
  }
  
  return {
    title,
    artist,
    album: 'Unknown Album',
    albumArtist: artist,
    year: null,
    genre: null,
    duration: null,
    coverArt: null
  };
}

/**
 * Extract title from URL as fallback
 * @param {string} url - The audio file URL
 * @returns {string} - Extracted title
 */
function extractTitleFromUrl(url) {
  const filename = decodeURIComponent(url.split('/').pop().replace(/\.[^/.]+$/, ''));
  
  // Remove common prefixes and clean up
  return filename
    .replace(/^\d+\s*-?\s*/, '') // Remove track numbers
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create a placeholder cover art image
 * @param {string} title - Song title
 * @param {string} artist - Artist name
 * @returns {string} - Data URL for placeholder image
 */
export function createPlaceholderCoverArt(title, artist) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = 300;
  canvas.height = 300;
  
  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, 300, 300);
  gradient.addColorStop(0, '#4f46e5');
  gradient.addColorStop(1, '#7c3aed');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 300, 300);
  
  // Add text
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Title
  ctx.font = 'bold 20px Arial';
  ctx.fillText(title.length > 20 ? title.substring(0, 20) + '...' : title, 150, 130);
  
  // Artist
  ctx.font = '16px Arial';
  ctx.fillText(artist.length > 25 ? artist.substring(0, 25) + '...' : artist, 150, 170);
  
  return canvas.toDataURL();
}
