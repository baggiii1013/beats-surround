/**
 * Audio Cache Manager - Persistent audio caching using IndexedDB
 * Caches decoded audio buffers to avoid re-downloading on page refresh
 */

const DB_NAME = 'BeatsAudioCache';
const DB_VERSION = 1;
const STORE_NAME = 'audioBuffers';
const METADATA_STORE = 'audioMetadata';

// Cache expiry time (7 days)
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

class AudioCacheManager {
  constructor() {
    this.db = null;
    this.initPromise = null;
    
    // Only initialize if we're in the browser
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initPromise = this.initDB();
    }
  }

  async initDB() {
    // Check if we're in the browser environment
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      throw new Error('IndexedDB not available');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store for audio buffers (ArrayBuffer format)
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const audioStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          audioStore.createIndex('url', 'url', { unique: false });
          audioStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }

        // Store for metadata and decoded buffers
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          const metaStore = db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
          metaStore.createIndex('url', 'url', { unique: false });
          metaStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };
    });
  }

  async ensureDB() {
    // Check if we're in browser environment
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      throw new Error('IndexedDB not available');
    }
    
    if (!this.db) {
      if (!this.initPromise) {
        this.initPromise = this.initDB();
      }
      await this.initPromise;
    }
    return this.db;
  }

  /**
   * Check if an audio file is cached
   */
  async isCached(audioId) {
    try {
      // Return false if not in browser environment
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return false;
      }
      
      const db = await this.ensureDB();
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      
      return new Promise((resolve) => {
        const request = store.get(audioId);
        request.onsuccess = () => {
          const result = request.result;
          if (!result) {
            resolve(false);
            return;
          }

          // Check if cache is expired
          const isExpired = Date.now() - result.cachedAt > CACHE_EXPIRY_MS;
          if (isExpired) {
            // Clean up expired cache entry
            this.removeFromCache(audioId);
            resolve(false);
          } else {
            resolve(true);
          }
        };
        request.onerror = () => resolve(false);
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cached audio buffer and metadata
   */
  async getCachedAudio(audioId) {
    try {
      // Return null if not in browser environment
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return null;
      }
      
      const db = await this.ensureDB();
      const tx = db.transaction([STORE_NAME, METADATA_STORE], 'readonly');
      const audioStore = tx.objectStore(STORE_NAME);
      const metaStore = tx.objectStore(METADATA_STORE);

      const [audioData, metadata] = await Promise.all([
        new Promise((resolve) => {
          const request = audioStore.get(audioId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        }),
        new Promise((resolve) => {
          const request = metaStore.get(audioId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        })
      ]);

      if (!audioData || !metadata) return null;

      // Check if cache is expired
      const isExpired = Date.now() - audioData.cachedAt > CACHE_EXPIRY_MS;
      if (isExpired) {
        this.removeFromCache(audioId);
        return null;
      }

      return {
        arrayBuffer: audioData.arrayBuffer,
        metadata: metadata.data,
        cachedAt: audioData.cachedAt
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Cache audio buffer and metadata
   */
  async cacheAudio(audioId, arrayBuffer, metadata = {}) {
    try {
      // Return false if not in browser environment
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return false;
      }
      
      const db = await this.ensureDB();
      const tx = db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');
      const audioStore = tx.objectStore(STORE_NAME);
      const metaStore = tx.objectStore(METADATA_STORE);

      const cachedAt = Date.now();

      // Store audio buffer
      const audioData = {
        id: audioId,
        arrayBuffer: arrayBuffer,
        url: metadata.url || null,
        cachedAt
      };

      // Store metadata
      const metaData = {
        id: audioId,
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
          uploadedAt: metadata.uploadedAt
        },
        cachedAt
      };

      await Promise.all([
        new Promise((resolve, reject) => {
          const request = audioStore.put(audioData);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
        new Promise((resolve, reject) => {
          const request = metaStore.put(metaData);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
      ]);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove audio from cache
   */
  async removeFromCache(audioId) {
    try {
      // Return false if not in browser environment
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return false;
      }
      
      const db = await this.ensureDB();
      const tx = db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');
      const audioStore = tx.objectStore(STORE_NAME);
      const metaStore = tx.objectStore(METADATA_STORE);

      await Promise.all([
        new Promise((resolve) => {
          const request = audioStore.delete(audioId);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve(); // Don't fail if not found
        }),
        new Promise((resolve) => {
          const request = metaStore.delete(audioId);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve(); // Don't fail if not found
        })
      ]);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear expired cache entries
   */
  async clearExpired() {
    try {
      // Return 0 if not in browser environment
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return 0;
      }
      
      const db = await this.ensureDB();
      const tx = db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');
      const audioStore = tx.objectStore(STORE_NAME);
      const metaStore = tx.objectStore(METADATA_STORE);

      const cutoffTime = Date.now() - CACHE_EXPIRY_MS;

      const expiredAudioIds = await new Promise((resolve) => {
        const ids = [];
        const request = audioStore.index('cachedAt').openCursor(IDBKeyRange.upperBound(cutoffTime));
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            ids.push(cursor.value.id);
            cursor.continue();
          } else {
            resolve(ids);
          }
        };
        request.onerror = () => resolve([]);
      });

      // Remove expired entries
      await Promise.all(expiredAudioIds.map(id => this.removeFromCache(id)));

      return expiredAudioIds.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      // Return empty stats if not in browser environment
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return { count: 0, totalSize: 0 };
      }
      
      const db = await this.ensureDB();
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);

      return new Promise((resolve) => {
        const stats = { count: 0, totalSize: 0 };
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            stats.count++;
            stats.totalSize += cursor.value.arrayBuffer.byteLength;
            cursor.continue();
          } else {
            resolve(stats);
          }
        };
        request.onerror = () => resolve(stats);
      });
    } catch (error) {
      return { count: 0, totalSize: 0 };
    }
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    try {
      // Return false if not in browser environment
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return false;
      }
      
      const db = await this.ensureDB();
      const tx = db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');
      
      await Promise.all([
        new Promise((resolve) => {
          const request = tx.objectStore(STORE_NAME).clear();
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
        }),
        new Promise((resolve) => {
          const request = tx.objectStore(METADATA_STORE).clear();
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
        })
      ]);

      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance - lazy loaded
let audioCacheManager = null;

const getAudioCacheManager = () => {
  if (!audioCacheManager && typeof window !== 'undefined' && 'indexedDB' in window) {
    audioCacheManager = new AudioCacheManager();
  }
  return audioCacheManager;
};

export default {
  get instance() {
    return getAudioCacheManager();
  }
};

// Utility functions for easy access
export const isCached = (audioId) => {
  const manager = getAudioCacheManager();
  return manager ? manager.isCached(audioId) : Promise.resolve(false);
};

export const getCachedAudio = (audioId) => {
  const manager = getAudioCacheManager();
  return manager ? manager.getCachedAudio(audioId) : Promise.resolve(null);
};

export const cacheAudio = (audioId, arrayBuffer, metadata) => {
  const manager = getAudioCacheManager();
  return manager ? manager.cacheAudio(audioId, arrayBuffer, metadata) : Promise.resolve(false);
};

export const removeFromCache = (audioId) => {
  const manager = getAudioCacheManager();
  return manager ? manager.removeFromCache(audioId) : Promise.resolve(false);
};

export const clearExpiredCache = () => {
  const manager = getAudioCacheManager();
  return manager ? manager.clearExpired() : Promise.resolve(0);
};

export const getCacheStats = () => {
  const manager = getAudioCacheManager();
  return manager ? manager.getCacheStats() : Promise.resolve({ count: 0, totalSize: 0 });
};

export const clearAllCache = () => {
  const manager = getAudioCacheManager();
  return manager ? manager.clearAll() : Promise.resolve(false);
};
