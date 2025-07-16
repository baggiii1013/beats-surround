// Minimal service worker for mobile audio background support
// This helps maintain audio context when the app goes to background on mobile Safari

const CACHE_NAME = 'beatsync-audio-v1';

// Install event
self.addEventListener('install', (event) => {
  // Service Worker: Installing...
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  // Service Worker: Activating...
  event.waitUntil(self.clients.claim());
});

// Message handler for audio-related commands
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'AUDIO_PLAYING':
      // Keep service worker active while audio is playing
      break;
      
    case 'AUDIO_PAUSED':
      // Audio paused state received
      break;
      
    case 'PING':
      // Respond to ping to keep connection alive
      // Send response back to main thread
      event.source?.postMessage({ type: 'PONG' });
      break;
      
    default:
      // Unknown message type
  }
});

// Keep service worker active with periodic self-ping
setInterval(() => {
  // This helps prevent the service worker from being terminated
  // Service Worker: Heartbeat
}, 30000); // Every 30 seconds
