// WebSocket configuration for different environments
const getWebSocketConfig = () => {
  // For production, you'll need to deploy your WebSocket server separately
  // and update these URLs accordingly
  
  if (typeof window === 'undefined') {
    // Server-side rendering
    return {
      wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
    };
  }

  // Client-side
  const isDev = process.env.NODE_ENV === 'development';
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isDev || isLocalhost) {
    return {
      wsUrl: 'ws://localhost:8080',
      apiUrl: 'http://localhost:8080'
    };
  }

  // Production environment
  // You'll need to replace these with your actual production WebSocket server URLs
  return {
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'wss://your-websocket-server.herokuapp.com',
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://your-websocket-server.herokuapp.com'
  };
};

export const { wsUrl: WS_URL, apiUrl: API_URL } = getWebSocketConfig();

export default getWebSocketConfig;
