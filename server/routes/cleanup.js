const express = require('express');
const { cleanupOrphanedRooms } = require('../lib/r2');

/**
 * Cleanup API Routes
 * Provides endpoints for monitoring and manually triggering cleanup operations
 */

/**
 * GET /api/cleanup/status
 * Get current cleanup system status and statistics
 */
async function handleCleanupStatus(req, res) {
  try {
    const cleanupManager = req.cleanupManager; // Passed from main server
    const health = cleanupManager.healthCheck();
    const stats = cleanupManager.getStats();
    
    res.json({
      success: true,
      health,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/cleanup/orphans
 * Manually trigger orphaned room cleanup
 * Query params:
 *   - dryRun: true/false (default: true)
 *   - force: true/false (default: false) - skip safety checks
 */
async function handleOrphanCleanup(req, res) {
  try {
    const dryRun = req.query.dryRun !== 'false'; // Default to dry run
    const force = req.query.force === 'true';
    const rooms = req.rooms; // Passed from main server
    
    // Safety check - don't clean up if too many active rooms (unless forced)
    const activeRoomIds = new Set(rooms.keys());
    if (!force && activeRoomIds.size > 100) {
      return res.status(400).json({
        success: false,
        error: 'Too many active rooms for safety. Use force=true to override.',
        activeRooms: activeRoomIds.size
      });
    }
    
    const result = await cleanupOrphanedRooms(activeRoomIds, !dryRun);
    
    res.json({
      success: true,
      mode: dryRun ? 'dry-run' : 'live',
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/cleanup/room/:roomId
 * Manually trigger cleanup for a specific room
 */
async function handleRoomCleanup(req, res) {
  try {
    const { roomId } = req.params;
    const cleanupManager = req.cleanupManager;
    const rooms = req.rooms;
    const force = req.query.force === 'true';
    
    if (!roomId) {
      return res.status(400).json({
        success: false,
        error: 'Room ID is required'
      });
    }
    
    const room = rooms.get(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        error: `Room ${roomId} not found`
      });
    }
    
    // Safety check - don't clean up rooms with active clients (unless forced)
    if (!force && room.clients.size > 0) {
      return res.status(400).json({
        success: false,
        error: `Room ${roomId} has ${room.clients.size} active clients. Use force=true to override.`,
        activeClients: room.clients.size
      });
    }
    
    const result = await cleanupManager.executeRoomCleanup(roomId, rooms);
    
    res.json({
      success: true,
      roomId,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      roomId: req.params.roomId,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/cleanup/orphans/scan
 * Scan for orphaned rooms without deleting anything (always dry run)
 */
async function handleOrphanScan(req, res) {
  try {
    const rooms = req.rooms;
    const activeRoomIds = new Set(rooms.keys());
    
    const result = await cleanupOrphanedRooms(activeRoomIds, false); // Always dry run
    
    res.json({
      success: true,
      mode: 'scan-only',
      activeRoomsInMemory: activeRoomIds.size,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  handleCleanupStatus,
  handleOrphanCleanup,
  handleRoomCleanup,
  handleOrphanScan
};
