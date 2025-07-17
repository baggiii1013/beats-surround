/**
 * Simple Audio Cache using IndexedDB for audio buffers and localStorage for metadata
 * Stores both metadata and actual audio data for offline playback
 */

const CACHE_KEY_PREFIX = 'beats_audio_cache_';
const METADATA_KEY = 'beats_audio_metadata';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DB_NAME = 'BeatsAudioCache';
const DB_VERSION = 1;
const STORE_NAME = 'audioBuffers';

class SimpleAudioCache {
  constructor() {
    this.isAvailable = typeof window !== 'undefined' && 'localStorage' in window && 'indexedDB' in window;
    this.dbPromise = null;
    if (this.isAvailable) {
      this.dbPromise = this.initDB();
    }
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };
    });
  }

  async getDB() {
    if (!this.dbPromise) {
      throw new Error('IndexedDB not available');
    }
    return await this.dbPromise;
  }

  /**
   * Check if audio is cached (metadata exists and not expired)
   */
  async isCached(audioId) {
    if (!this.isAvailable) return false;

    try {
      const metadata = this.getMetadata(audioId);
      if (!metadata) return false;

      // Check if expired
      const isExpired = Date.now() - metadata.cachedAt > CACHE_EXPIRY_MS;
      if (isExpired) {
        await this.removeFromCache(audioId);
        return false;
      }

      // Check if IndexedDB entry exists
      try {
        const db = await this.getDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(audioId);
        
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(!!request.result);
          request.onerror = () => resolve(false);
        });
      } catch (dbError) {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cached audio data
   */
  async getCachedAudio(audioId) {
    if (!this.isAvailable) return null;

    try {
      const metadata = this.getMetadata(audioId);
      if (!metadata) return null;

      // Check if expired
      const isExpired = Date.now() - metadata.cachedAt > CACHE_EXPIRY_MS;
      if (isExpired) {
        await this.removeFromCache(audioId);
        return null;
      }

      // Get actual audio data from IndexedDB
      try {
        const db = await this.getDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(audioId);
        
        return new Promise((resolve) => {
          request.onsuccess = () => {
            const result = request.result;
            if (result && result.arrayBuffer) {
              resolve({
                arrayBuffer: result.arrayBuffer,
                metadata: metadata.data,
                cachedAt: metadata.cachedAt
              });
            } else {
              resolve(null);
            }
          };
          request.onerror = () => resolve(null);
        });
      } catch (dbError) {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Cache audio data (both metadata and actual audio buffer)
   */
  async cacheAudio(audioId, arrayBuffer, metadata = {}) {
    if (!this.isAvailable) return false;

    try {
      // Store metadata in localStorage
      const cacheEntry = {
        id: audioId,
        cachedAt: Date.now(),
        data: {
          name: metadata.name,
          artist: metadata.artist,
          album: metadata.album,
          albumArtist: metadata.albumArtist,
          year: metadata.year,
          genre: metadata.genre,
          duration: metadata.duration,
          coverArt: metadata.coverArt,
          url: metadata.url,
          type: metadata.type,
          uploadedAt: metadata.uploadedAt,
          size: arrayBuffer ? arrayBuffer.byteLength : 0
        }
      };

      localStorage.setItem(CACHE_KEY_PREFIX + audioId, JSON.stringify(cacheEntry));
      
      // Update global metadata index
      this.updateMetadataIndex(audioId, cacheEntry);

      // Store actual audio data in IndexedDB
      if (arrayBuffer) {
        try {
          const db = await this.getDB();
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          
          const audioData = {
            id: audioId,
            arrayBuffer: arrayBuffer,
            cachedAt: Date.now()
          };
          
          await new Promise((resolve, reject) => {
            const request = store.put(audioData);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        } catch (dbError) {
          // Still return true since metadata was stored
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove audio from cache (both metadata and audio data)
   */
  async removeFromCache(audioId) {
    if (!this.isAvailable) return false;

    try {
      // Remove from localStorage
      localStorage.removeItem(CACHE_KEY_PREFIX + audioId);
      this.removeFromMetadataIndex(audioId);
      
      // Remove from IndexedDB
      try {
        const db = await this.getDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        await new Promise((resolve, reject) => {
          const request = store.delete(audioId);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (dbError) {
        // Silently continue
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear expired cache entries (both metadata and audio data)
   */
  async clearExpired() {
    if (!this.isAvailable) return 0;

    try {
      const expiredIds = [];
      const cutoffTime = Date.now() - CACHE_EXPIRY_MS;

      // Check all cache entries
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item && item.cachedAt < cutoffTime) {
              const audioId = key.replace(CACHE_KEY_PREFIX, '');
              expiredIds.push(audioId);
            }
          } catch (parseError) {
            // Remove invalid entries
            const audioId = key.replace(CACHE_KEY_PREFIX, '');
            expiredIds.push(audioId);
          }
        }
      }

      // Remove expired entries
      for (const id of expiredIds) {
        await this.removeFromCache(id);
      }

      return expiredIds.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    if (!this.isAvailable) return { count: 0, totalSize: 0 };

    try {
      let count = 0;
      let totalSize = 0;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item && item.data) {
              count++;
              totalSize += item.data.size || 0;
            }
          } catch (parseError) {
            // Skip invalid entries
          }
        }
      }

      return { count, totalSize };
    } catch (error) {
      return { count: 0, totalSize: 0 };
    }
  }

  /**
   * Clear all cache (both metadata and audio data)
   */
  async clearAll() {
    if (!this.isAvailable) return false;

    try {
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(CACHE_KEY_PREFIX) || key === METADATA_KEY)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear IndexedDB
      try {
        const db = await this.getDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        await new Promise((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (dbError) {
        // Silently continue
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all cached audio metadata (for restoring user uploads on page refresh)
   */
  async getAllCachedAudio() {
    if (!this.isAvailable) return [];

    try {
      const cachedAudio = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item && item.data) {
              // Check if expired
              const isExpired = Date.now() - item.cachedAt > CACHE_EXPIRY_MS;
              if (!isExpired) {
                cachedAudio.push({
                  id: item.id,
                  ...item.data,
                  cachedAt: item.cachedAt
                });
              } else {
                // Remove expired entry
                await this.removeFromCache(item.id);
              }
            }
          } catch (parseError) {
            // Skip invalid entries
          }
        }
      }

      return cachedAudio;
    } catch (error) {
      return [];
    }
  }

  // Helper methods
  getMetadata(audioId) {
    if (!this.isAvailable) return null;

    try {
      const item = localStorage.getItem(CACHE_KEY_PREFIX + audioId);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      return null;
    }
  }

  updateMetadataIndex(audioId, entry) {
    if (!this.isAvailable) return;

    try {
      const index = this.getMetadataIndex();
      index[audioId] = {
        name: entry.data.name,
        cachedAt: entry.cachedAt,
        size: entry.data.size || 0
      };
      localStorage.setItem(METADATA_KEY, JSON.stringify(index));
    } catch (error) {
      // Ignore index update errors
    }
  }

  removeFromMetadataIndex(audioId) {
    if (!this.isAvailable) return;

    try {
      const index = this.getMetadataIndex();
      delete index[audioId];
      localStorage.setItem(METADATA_KEY, JSON.stringify(index));
    } catch (error) {
      // Ignore index update errors
    }
  }

  getMetadataIndex() {
    if (!this.isAvailable) return {};

    try {
      const item = localStorage.getItem(METADATA_KEY);
      return item ? JSON.parse(item) : {};
    } catch (error) {
      return {};
    }
  }
}

// Singleton instance - lazy loaded
let simpleAudioCache = null;

const getSimpleAudioCache = () => {
  if (!simpleAudioCache && typeof window !== 'undefined') {
    simpleAudioCache = new SimpleAudioCache();
  }
  return simpleAudioCache;
};

export default {
  get instance() {
    return getSimpleAudioCache();
  }
};

// Utility functions for easy access
export const isCached = (audioId) => {
  const cache = getSimpleAudioCache();
  return cache ? cache.isCached(audioId) : Promise.resolve(false);
};

export const getCachedAudio = (audioId) => {
  const cache = getSimpleAudioCache();
  return cache ? cache.getCachedAudio(audioId) : Promise.resolve(null);
};

export const cacheAudio = (audioId, arrayBuffer, metadata) => {
  const cache = getSimpleAudioCache();
  return cache ? cache.cacheAudio(audioId, arrayBuffer, metadata) : Promise.resolve(false);
};

export const removeFromCache = (audioId) => {
  const cache = getSimpleAudioCache();
  return cache ? cache.removeFromCache(audioId) : Promise.resolve(false);
};

export const clearExpiredCache = () => {
  const cache = getSimpleAudioCache();
  return cache ? cache.clearExpired() : Promise.resolve(0);
};

export const getCacheStats = () => {
  const cache = getSimpleAudioCache();
  return cache ? cache.getCacheStats() : Promise.resolve({ count: 0, totalSize: 0 });
};

export const clearAllCache = () => {
  const cache = getSimpleAudioCache();
  return cache ? cache.clearAll() : Promise.resolve(false);
};

export const getAllCachedAudio = () => {
  const cache = getSimpleAudioCache();
  return cache ? cache.getAllCachedAudio() : Promise.resolve([]);
};
