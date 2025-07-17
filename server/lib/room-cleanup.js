const { listObjectsWithPrefix, deleteObjects, S3_CONFIG } = require('./r2');

/**
 * Enhanced Room Cleanup Manager
 * Inspired by BeatSync but with improvements for robustness and efficiency
 */
class RoomCleanupManager {
  constructor() {
    // Configuration with different grace periods for different scenarios
    this.config = {
      // Extended grace period to handle page refreshes and network issues
      CLEANUP_GRACE_PERIOD: parseInt(process.env.ROOM_CLEANUP_GRACE_PERIOD) || 10 * 60 * 1000, // 10 minutes default (increased from 5)
      
      // Grace period for emergency cleanup (server shutdown)
      EMERGENCY_CLEANUP_GRACE_PERIOD: 30 * 1000, // 30 seconds
      
      // How often to check for orphaned rooms
      ORPHAN_CHECK_INTERVAL: parseInt(process.env.ORPHAN_CHECK_INTERVAL) || 60 * 60 * 1000, // 1 hour
      
      // Maximum batch size for R2 deletions
      MAX_BATCH_DELETE_SIZE: 1000,
      
      // Maximum concurrent cleanup operations
      MAX_CONCURRENT_CLEANUPS: 5,
      
      // Retry configuration
      MAX_CLEANUP_RETRIES: 3,
      RETRY_DELAY_BASE: 1000, // 1 second base delay
      
      // Page refresh grace period - longer grace for potential page refreshes
      PAGE_REFRESH_GRACE_PERIOD: parseInt(process.env.PAGE_REFRESH_GRACE_PERIOD) || 3 * 60 * 1000, // 3 minutes
    };
    
    // Active cleanup timers (roomId -> timer)
    this.cleanupTimers = new Map();
    
    // Room last activity tracking for intelligent cleanup
    this.roomLastActivity = new Map();
    
    // Active cleanup operations (roomId -> promise)
    this.activeCleanups = new Map();
    
    // Cleanup statistics
    this.stats = {
      totalCleanups: 0,
      successfulCleanups: 0,
      failedCleanups: 0,
      filesDeleted: 0,
      orphanedRoomsFound: 0,
      lastOrphanCheck: null,
      pageRefreshReconnections: 0
    };
    
    // Start periodic orphan cleanup if enabled
    if (process.env.ENABLE_ORPHAN_CLEANUP !== 'false') {
      this.startOrphanCleanupScheduler();
    }
  }

  /**
   * Schedule cleanup for a room after the grace period
   * Cancels any existing cleanup for the same room
   */
  scheduleRoomCleanup(roomId, rooms) {
    // Cancel existing cleanup if any
    this.cancelRoomCleanup(roomId);
    
    const timer = setTimeout(async () => {
      try {
        await this.executeRoomCleanup(roomId, rooms);
      } catch (error) {
        this.stats.failedCleanups++;
      } finally {
        this.cleanupTimers.delete(roomId);
      }
    }, this.config.CLEANUP_GRACE_PERIOD);
    
    this.cleanupTimers.set(roomId, timer);
  }

  /**
   * Schedule emergency cleanup (e.g., server shutdown)
   */
  scheduleEmergencyCleanup(roomId, rooms) {
    // Cancel existing cleanup if any
    this.cancelRoomCleanup(roomId);
    
    const timer = setTimeout(async () => {
      try {
        await this.executeRoomCleanup(roomId, rooms, true);
      } catch (error) {
        // Silent fail for emergency cleanup
      } finally {
        this.cleanupTimers.delete(roomId);
      }
    }, this.config.EMERGENCY_CLEANUP_GRACE_PERIOD);
    
    this.cleanupTimers.set(roomId, timer);
  }

  /**
   * Cancel scheduled cleanup for a room (e.g., when client reconnects)
   */
  cancelRoomCleanup(roomId) {
    const timer = this.cleanupTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(roomId);
      
      // Track page refresh reconnections if this was recent
      const lastActivity = this.roomLastActivity.get(roomId);
      if (lastActivity && Date.now() - lastActivity < this.config.PAGE_REFRESH_GRACE_PERIOD) {
        this.stats.pageRefreshReconnections++;
      }
      
      return true;
    }
    return false;
  }

  /**
   * Track room activity for intelligent cleanup decisions
   */
  trackRoomActivity(roomId) {
    this.roomLastActivity.set(roomId, Date.now());
  }

  /**
   * Get time since last room activity
   */
  getTimeSinceLastActivity(roomId) {
    const lastActivity = this.roomLastActivity.get(roomId);
    return lastActivity ? Date.now() - lastActivity : Infinity;
  }

  /**
   * Schedule room cleanup with intelligent timing based on activity
   */
  scheduleRoomCleanup(roomId, rooms, options = {}) {
    const { isEmergency = false, force = false } = options;
    
    // Track that room became empty
    this.trackRoomActivity(roomId);
    
    // Cancel any existing cleanup timer
    this.cancelRoomCleanup(roomId);
    
    const timeSinceActivity = this.getTimeSinceLastActivity(roomId);
    
    // Determine appropriate grace period
    let gracePeriod;
    if (isEmergency) {
      gracePeriod = this.config.EMERGENCY_CLEANUP_GRACE_PERIOD;
    } else if (timeSinceActivity < this.config.PAGE_REFRESH_GRACE_PERIOD) {
      // Recent activity suggests possible page refresh - use longer grace period
      gracePeriod = this.config.CLEANUP_GRACE_PERIOD;
    } else {
      gracePeriod = this.config.CLEANUP_GRACE_PERIOD;
    }
    
    const timer = setTimeout(async () => {
      try {
        await this.executeRoomCleanup(roomId, rooms, isEmergency);
      } catch (error) {
        console.error(`Failed to cleanup room ${roomId}:`, error);
      } finally {
        this.cleanupTimers.delete(roomId);
        this.roomLastActivity.delete(roomId);
      }
    }, gracePeriod);
    
    this.cleanupTimers.set(roomId, timer);
  }

  /**
   * Execute cleanup for a specific room with retry logic
   */
  async executeRoomCleanup(roomId, rooms, isEmergency = false) {
    // Check if already being cleaned up
    if (this.activeCleanups.has(roomId)) {
      return await this.activeCleanups.get(roomId);
    }

    const cleanupPromise = this._performRoomCleanup(roomId, rooms, isEmergency);
    this.activeCleanups.set(roomId, cleanupPromise);
    
    try {
      const result = await cleanupPromise;
      return result;
    } finally {
      this.activeCleanups.delete(roomId);
    }
  }

  /**
   * Internal method to perform the actual cleanup with retries
   */
  async _performRoomCleanup(roomId, rooms, isEmergency = false) {
    const startTime = Date.now();
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.MAX_CLEANUP_RETRIES; attempt++) {
      try {
        // Double-check room is still empty (unless emergency)
        if (!isEmergency) {
          const room = rooms.get(roomId);
          if (room && room.clients.size > 0) {
            return { success: true, reason: 'room_not_empty', filesDeleted: 0 };
          }
        }

        // Get list of files to delete
        const objects = await listObjectsWithPrefix(`room-${roomId}/`);
        
        if (!objects || objects.length === 0) {
          // Still remove the room from memory
          rooms.delete(roomId);
          this.stats.successfulCleanups++;
          return { success: true, reason: 'no_files', filesDeleted: 0 };
        }

        // Delete files in batches
        const filesToDelete = objects.map(obj => obj.Key);
        const deletedCount = await this._deleteFilesInBatches(filesToDelete);
        
        // Remove room from memory
        const room = rooms.get(roomId);
        if (room) {
          room.cleanup(); // Clean up room internals
          rooms.delete(roomId);
        }

        const duration = Date.now() - startTime;
        
        this.stats.totalCleanups++;
        this.stats.successfulCleanups++;
        this.stats.filesDeleted += deletedCount;
        
        return { 
          success: true, 
          reason: 'completed', 
          filesDeleted: deletedCount,
          duration 
        };
        
      } catch (error) {
        lastError = error;
        
        // Wait before retry (exponential backoff)
        if (attempt < this.config.MAX_CLEANUP_RETRIES) {
          const delay = this.config.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    this.stats.totalCleanups++;
    this.stats.failedCleanups++;
    
    throw new Error(`Failed to cleanup room ${roomId} after ${this.config.MAX_CLEANUP_RETRIES} attempts: ${lastError.message}`);
  }

  /**
   * Delete files in batches with error handling
   */
  async _deleteFilesInBatches(filesToDelete) {
    let totalDeleted = 0;
    const batchSize = this.config.MAX_BATCH_DELETE_SIZE;
    
    for (let i = 0; i < filesToDelete.length; i += batchSize) {
      const batch = filesToDelete.slice(i, i + batchSize);
      
      try {
        const success = await deleteObjects(batch);
        if (success) {
          totalDeleted += batch.length;
        }
      } catch (error) {
        // Continue with next batch instead of failing completely
      }
    }
    
    return totalDeleted;
  }

  /**
   * Find and clean up orphaned rooms (exist in R2 but not in server memory)
   */
  async cleanupOrphanedRooms(activeRooms, dryRun = false) {
    const startTime = Date.now();
    
    try {
      // Get all room objects from R2
      const allObjects = await listObjectsWithPrefix('room-');
      
      if (!allObjects || allObjects.length === 0) {
        return { orphanedRooms: [], totalFiles: 0, deletedFiles: 0 };
      }

      // Group objects by room
      const roomsInR2 = new Map();
      allObjects.forEach(obj => {
        const match = obj.Key.match(/^room-([^\/]+)\//);
        if (match) {
          const roomId = match[1];
          if (!roomsInR2.has(roomId)) {
            roomsInR2.set(roomId, []);
          }
          roomsInR2.get(roomId).push(obj.Key);
        }
      });

      // Find orphaned rooms
      const orphanedRooms = [];
      let totalFiles = 0;
      
      roomsInR2.forEach((files, roomId) => {
        if (!activeRooms.has(roomId)) {
          orphanedRooms.push({
            roomId,
            fileCount: files.length,
            files: files
          });
          totalFiles += files.length;
        }
      });

      if (orphanedRooms.length === 0) {
        this.stats.lastOrphanCheck = new Date();
        return { orphanedRooms: [], totalFiles: 0, deletedFiles: 0 };
      }

      this.stats.orphanedRoomsFound += orphanedRooms.length;

      if (dryRun) {
        this.stats.lastOrphanCheck = new Date();
        return { orphanedRooms, totalFiles, deletedFiles: 0 };
      }

      // Delete orphaned rooms
      let deletedFiles = 0;
      const errors = [];
      
      // Process orphaned rooms with concurrency limit
      const concurrentLimit = this.config.MAX_CONCURRENT_CLEANUPS;
      for (let i = 0; i < orphanedRooms.length; i += concurrentLimit) {
        const batch = orphanedRooms.slice(i, i + concurrentLimit);
        
        const promises = batch.map(async (orphan) => {
          try {
            const deleted = await this._deleteFilesInBatches(orphan.files);
            return deleted;
          } catch (error) {
            errors.push(`${orphan.roomId}: ${error.message}`);
            return 0;
          }
        });

        const results = await Promise.all(promises);
        deletedFiles += results.reduce((sum, count) => sum + count, 0);
      }

      this.stats.lastOrphanCheck = new Date();
      this.stats.filesDeleted += deletedFiles;
      
      return { orphanedRooms, totalFiles, deletedFiles, errors };
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Start the periodic orphan cleanup scheduler
   */
  startOrphanCleanupScheduler() {
    if (this.orphanCleanupInterval) {
      return; // Already started
    }
    
    this.orphanCleanupInterval = setInterval(async () => {
      try {
        // The actual cleanup will be triggered by the main server calling cleanupOrphanedRooms
      } catch (error) {
        // Silent fail for scheduled cleanup
      }
    }, this.config.ORPHAN_CHECK_INTERVAL);
  }

  /**
   * Stop the orphan cleanup scheduler
   */
  stopOrphanCleanupScheduler() {
    if (this.orphanCleanupInterval) {
      clearInterval(this.orphanCleanupInterval);
      this.orphanCleanupInterval = null;
    }
  }

  /**
   * Perform emergency cleanup of all active rooms (e.g., server shutdown)
   */
  async emergencyCleanupAll(rooms) {
    // Cancel all pending cleanups
    this.cleanupTimers.forEach((timer, roomId) => {
      clearTimeout(timer);
    });
    this.cleanupTimers.clear();

    // Wait for any active cleanups to complete
    if (this.activeCleanups.size > 0) {
      await Promise.allSettled(Array.from(this.activeCleanups.values()));
    }

    // Clean up room internals (timers, intervals, etc.)
    rooms.forEach(room => {
      if (room.cleanup) {
        room.cleanup();
      }
    });
  }

  /**
   * Get cleanup statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeCleanupTimers: this.cleanupTimers.size,
      activeCleanupOperations: this.activeCleanups.size,
      config: this.config
    };
  }

  /**
   * Health check for cleanup system
   */
  healthCheck() {
    const issues = [];
    
    // Check R2 configuration
    if (!S3_CONFIG.BUCKET_NAME || !S3_CONFIG.ACCESS_KEY_ID) {
      issues.push('R2 configuration incomplete');
    }
    
    // Check for stuck cleanups
    if (this.activeCleanups.size > this.config.MAX_CONCURRENT_CLEANUPS) {
      issues.push(`Too many concurrent cleanups: ${this.activeCleanups.size}`);
    }
    
    // Check last orphan check
    if (this.stats.lastOrphanCheck) {
      const timeSinceCheck = Date.now() - this.stats.lastOrphanCheck.getTime();
      if (timeSinceCheck > this.config.ORPHAN_CHECK_INTERVAL * 2) {
        issues.push('Orphan cleanup overdue');
      }
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      stats: this.getStats()
    };
  }
}

module.exports = RoomCleanupManager;
