// Ultra Low-Latency Configuration for BeatsSurround Server
// Optimized for sub-5ms latency performance

module.exports = {
  // WebSocket optimizations
  websocket: {
    perMessageDeflate: false,           // Disable compression for speed
    maxPayload: 50 * 1024 * 1024,      // 50MB max payload
    clientTracking: true,
    handleProtocols: false,             // Disable protocol negotiation
    backlog: 1024,                      // Increase connection backlog
    maxConnections: 10000,              // Max concurrent connections
  },

  // Timing configurations (ultra-low latency)
  timing: {
    scheduleTimeMs: 10,                 // Ultra-low scheduling delay
    maxNtpMeasurements: 5,              // Faster NTP sync
    spatialUpdateInterval: 8,           // 120fps spatial updates
    messageBatchSize: 1,                // No batching for minimal delay
    highFrequencyMode: true,            // Enable all optimizations
    ntpTimeoutMs: 100,                  // Fast NTP timeout
  },

  // Server optimizations
  server: {
    keepAliveTimeout: 1000,             // Shorter keep-alive
    headersTimeout: 2000,               // Faster header timeout
    timeout: 5000,                      // Shorter overall timeout
    maxHeaderSize: 8192,                // Smaller header size
    noDelay: true,                      // Disable Nagle's algorithm
    keepAlive: true,                    // Enable TCP keep-alive
    keepAliveInitialDelay: 0,           // Immediate keep-alive
  },

  // Node.js process optimizations
  process: {
    uvThreadpoolSize: 16,               // More UV threads
    priority: -10,                      // High process priority
    maxOldSpaceSize: 4096,              // 4GB heap limit
    gcConcurrent: true,                 // Enable concurrent GC
  },

  // Memory and performance
  performance: {
    enableGcOptimizations: true,
    preallocateBuffers: true,
    useObjectPools: true,
    minimizeStringAllocations: true,
  },

  // Development vs Production
  development: {
    enableDetailedLogging: false,       // Minimal logging overhead
    enableProfiling: false,
    enableMetrics: false,
  },

  // Network optimizations
  network: {
    tcpNoDelay: true,                   // Disable Nagle's algorithm
    tcpKeepAlive: true,                 // Enable TCP keep-alive
    socketTimeout: 1000,                // Fast socket timeout
    maxSockets: 1000,                   // Max sockets per origin
    maxFreeSockets: 256,                // Max free sockets
  }
};
