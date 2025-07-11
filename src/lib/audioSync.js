// Enhanced Audio Synchronization Library
// Inspired by Beatsync's high-precision synchronization

export class AudioSyncEngine {
  constructor() {
    this.clockOffset = 0;
    this.clockDrift = 0;
    this.lastSyncTime = 0;
    this.ntpMeasurements = [];
    this.maxMeasurements = 50;
    this.syncTolerance = 50; // ms
    this.driftCompensation = true;
    this.syncQuality = 'unknown'; // poor, fair, good, excellent
  }

  // Enhanced NTP measurement with outlier detection
  addNTPMeasurement(measurement) {
    // Filter out obvious outliers (RTT > 1000ms)
    if (measurement.roundTripDelay > 1000) {
      console.warn('Discarding NTP measurement with high RTT:', measurement.roundTripDelay);
      return;
    }

    this.ntpMeasurements.push({
      ...measurement,
      timestamp: Date.now()
    });

    // Keep only recent measurements (last 2 minutes)
    const cutoffTime = Date.now() - 120000;
    this.ntpMeasurements = this.ntpMeasurements.filter(m => m.timestamp > cutoffTime);

    // Limit array size
    if (this.ntpMeasurements.length > this.maxMeasurements) {
      this.ntpMeasurements.shift();
    }

    this.updateClockEstimates();
  }

  updateClockEstimates() {
    if (this.ntpMeasurements.length < 3) return;

    // Use Cristian's algorithm with improved filtering
    const sortedByRTT = [...this.ntpMeasurements].sort((a, b) => a.roundTripDelay - b.roundTripDelay);
    
    // Take best 50% of measurements by RTT
    const bestMeasurements = sortedByRTT.slice(0, Math.ceil(sortedByRTT.length * 0.5));
    
    // Calculate weighted average (prefer recent measurements)
    const now = Date.now();
    let totalWeight = 0;
    let weightedOffsetSum = 0;
    
    bestMeasurements.forEach(measurement => {
      // Weight by recency and RTT quality
      const age = now - measurement.timestamp;
      const ageWeight = Math.exp(-age / 30000); // Exponential decay over 30 seconds
      const rttWeight = 1 / (1 + measurement.roundTripDelay / 100); // Lower RTT = higher weight
      const weight = ageWeight * rttWeight;
      
      weightedOffsetSum += measurement.clockOffset * weight;
      totalWeight += weight;
    });

    const newOffset = weightedOffsetSum / totalWeight;
    
    // Calculate drift compensation
    if (this.lastSyncTime > 0 && this.driftCompensation) {
      const timeSinceLastSync = now - this.lastSyncTime;
      if (timeSinceLastSync > 5000) { // Only calculate drift after 5+ seconds
        const offsetDelta = newOffset - this.clockOffset;
        this.clockDrift = offsetDelta / (timeSinceLastSync / 1000); // drift per second
      }
    }

    this.clockOffset = newOffset;
    this.lastSyncTime = now;
    
    // Update sync quality
    this.updateSyncQuality(bestMeasurements);
  }

  updateSyncQuality(measurements) {
    if (measurements.length < 3) {
      this.syncQuality = 'poor';
      return;
    }

    const avgRTT = measurements.reduce((sum, m) => sum + m.roundTripDelay, 0) / measurements.length;
    const offsetVariance = this.calculateVariance(measurements.map(m => m.clockOffset));

    if (avgRTT < 50 && offsetVariance < 10) {
      this.syncQuality = 'excellent';
      this.syncTolerance = 25;
    } else if (avgRTT < 100 && offsetVariance < 25) {
      this.syncQuality = 'good';
      this.syncTolerance = 50;
    } else if (avgRTT < 200 && offsetVariance < 50) {
      this.syncQuality = 'fair';
      this.syncTolerance = 100;
    } else {
      this.syncQuality = 'poor';
      this.syncTolerance = 200;
    }
  }

  calculateVariance(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length);
  }

  // Get current server time with drift compensation
  getServerTime() {
    const localTime = Date.now();
    const timeSinceLastSync = localTime - this.lastSyncTime;
    const driftAdjustment = this.clockDrift * (timeSinceLastSync / 1000);
    
    return localTime + this.clockOffset + driftAdjustment;
  }

  // Calculate precise wait time for scheduling
  calculateWaitTime(targetServerTime) {
    const serverNow = this.getServerTime();
    return Math.max(0, targetServerTime - serverNow);
  }

  // High-precision audio scheduling using AudioContext
  scheduleAudioAction(audioContext, action, targetServerTime) {
    const waitTimeMs = this.calculateWaitTime(targetServerTime);
    const audioContextTime = audioContext.currentTime + (waitTimeMs / 1000);
    
    // Use AudioContext's high-precision timing
    return {
      audioContextTime,
      waitTimeMs,
      accuracy: this.syncQuality
    };
  }

  // Check if we need to resync due to poor quality
  needsResync() {
    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    return (
      this.syncQuality === 'poor' ||
      timeSinceLastSync > 60000 || // Resync every minute
      this.ntpMeasurements.length < 5
    );
  }

  // Get synchronization status
  getSyncStatus() {
    const measurements = this.ntpMeasurements;
    const avgRTT = measurements.length > 0 
      ? measurements.reduce((sum, m) => sum + m.roundTripDelay, 0) / measurements.length 
      : 0;
    const jitter = measurements.length > 1 
      ? this.calculateVariance(measurements.map(m => m.roundTripDelay))
      : 0;

    return {
      isSync: this.ntpMeasurements.length >= 5,
      quality: {
        latency: avgRTT,
        jitter: jitter,
        accuracy: this.ntpMeasurements.length >= 5 ? 0.95 : 0,
        clockDrift: this.clockDrift,
        qualityLevel: this.syncQuality,
        lastUpdate: this.lastSyncTime
      },
      clockOffset: this.clockOffset,
      clockDrift: this.clockDrift,
      tolerance: this.syncTolerance,
      measurementCount: this.ntpMeasurements.length,
      lastSyncAge: Date.now() - this.lastSyncTime
    };
  }
}

// Enhanced audio playback controller
export class SyncedAudioController {
  constructor(audioContext, syncEngine) {
    this.audioContext = audioContext;
    this.syncEngine = syncEngine;
    this.activeNodes = new Map();
    this.scheduleBuffer = 0.1; // 100ms buffer for scheduling
  }

  // Schedule precise audio playback
  async schedulePlay({ audioBuffer, startTime, offset = 0, trackId, fadeIn = false }) {
    if (!audioBuffer) throw new Error('Audio buffer required');

    // Stop any existing playback for this track
    this.stopTrack(trackId);

    // Create new source node
    const sourceNode = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Calculate precise timing
    const timing = this.syncEngine.scheduleAudioAction(this.audioContext, 'play', startTime);
    const scheduleTime = Math.max(timing.audioContextTime, this.audioContext.currentTime + this.scheduleBuffer);

    // Apply fade-in if requested
    if (fadeIn) {
      gainNode.gain.setValueAtTime(0, scheduleTime);
      gainNode.gain.linearRampToValueAtTime(1, scheduleTime + 0.1);
    }

    // Schedule playback
    sourceNode.start(scheduleTime, offset);

    // Store reference for later control
    this.activeNodes.set(trackId, {
      sourceNode,
      gainNode,
      startTime: scheduleTime,
      offset,
      trackId
    });

    return {
      scheduledTime: scheduleTime,
      accuracy: timing.accuracy,
      bufferTime: scheduleTime - this.audioContext.currentTime
    };
  }

  // Schedule precise pause
  schedulePause(trackId, targetServerTime) {
    const node = this.activeNodes.get(trackId);
    if (!node) return null;

    const timing = this.syncEngine.scheduleAudioAction(this.audioContext, 'pause', targetServerTime);
    const stopTime = Math.max(timing.audioContextTime, this.audioContext.currentTime + 0.01);

    // Calculate current position when stopping
    const elapsedTime = stopTime - node.startTime;
    const currentPosition = node.offset + elapsedTime;

    // Apply fade-out for smooth stop
    node.gainNode.gain.setValueAtTime(node.gainNode.gain.value, stopTime);
    node.gainNode.gain.linearRampToValueAtTime(0, stopTime + 0.05);

    // Schedule stop
    node.sourceNode.stop(stopTime + 0.05);

    // Remove from active nodes
    this.activeNodes.delete(trackId);

    return {
      stopTime,
      currentPosition,
      accuracy: timing.accuracy
    };
  }

  // Stop track immediately
  stopTrack(trackId) {
    const node = this.activeNodes.get(trackId);
    if (node) {
      try {
        node.sourceNode.stop();
      } catch (e) {
        // Already stopped
      }
      this.activeNodes.delete(trackId);
    }
  }

  // Get current playback position
  getCurrentPosition(trackId) {
    const node = this.activeNodes.get(trackId);
    if (!node) return 0;

    const currentTime = this.audioContext.currentTime;
    const elapsedTime = currentTime - node.startTime;
    return Math.max(0, node.offset + elapsedTime);
  }

  // Check if track is playing
  isPlaying(trackId) {
    return this.activeNodes.has(trackId);
  }

  // Clean up all audio nodes
  cleanup() {
    this.activeNodes.forEach((node, trackId) => {
      this.stopTrack(trackId);
    });
    this.activeNodes.clear();
  }
}

// Export singleton instances
let syncEngine = null;
let audioController = null;

export const getSyncEngine = () => {
  if (!syncEngine) {
    syncEngine = new AudioSyncEngine();
  }
  return syncEngine;
};

export const getAudioController = (audioContext) => {
  if (!audioController && audioContext) {
    audioController = new SyncedAudioController(audioContext, getSyncEngine());
  }
  return audioController;
};

// Utility functions
export const createHighPrecisionTimer = (callback, interval) => {
  let lastTime = performance.now();
  let frame;

  const tick = (currentTime) => {
    if (currentTime - lastTime >= interval) {
      callback();
      lastTime = currentTime;
    }
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);
  
  return () => cancelAnimationFrame(frame);
};

export const measureNetworkLatency = async (serverUrl, samples = 5) => {
  const measurements = [];
  
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    try {
      await fetch(`${serverUrl}/api/ping`, { method: 'HEAD' });
      const rtt = performance.now() - start;
      measurements.push(rtt);
    } catch (error) {
      console.warn('Network latency measurement failed:', error);
    }
    
    // Wait between measurements
    if (i < samples - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  if (measurements.length === 0) return null;
  
  // Return median RTT
  measurements.sort((a, b) => a - b);
  const median = measurements[Math.floor(measurements.length / 2)];
  
  return {
    median,
    average: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
    min: Math.min(...measurements),
    max: Math.max(...measurements),
    samples: measurements.length
  };
};
