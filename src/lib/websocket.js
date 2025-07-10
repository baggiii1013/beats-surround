// WebSocket message types for BeatsSurround
export const ClientActionTypes = {
  NTP_REQUEST: 'NTP_REQUEST',
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  SET_TRACK: 'SET_TRACK',
  SET_POSITION: 'SET_POSITION',
  SPATIAL_AUDIO_START: 'SPATIAL_AUDIO_START',
  SPATIAL_AUDIO_STOP: 'SPATIAL_AUDIO_STOP',
  SET_LISTENING_SOURCE: 'SET_LISTENING_SOURCE',
  UPLOAD_AUDIO: 'UPLOAD_AUDIO'
};

export const ServerActionTypes = {
  NTP_RESPONSE: 'NTP_RESPONSE',
  SCHEDULED_ACTION: 'SCHEDULED_ACTION',
  TRACK_CHANGE: 'TRACK_CHANGE',
  CLIENT_UPDATE: 'CLIENT_UPDATE',
  NEW_AUDIO_SOURCE: 'NEW_AUDIO_SOURCE',
  CONNECTION_ESTABLISHED: 'CONNECTION_ESTABLISHED'
};

export const ScheduledActionTypes = {
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  SPATIAL_CONFIG: 'SPATIAL_CONFIG',
  SPATIAL_CONFIG_STOP: 'SPATIAL_CONFIG_STOP'
};

// NTP-inspired time synchronization
export const epochNow = () => Date.now();

export const calculateWaitTimeMilliseconds = (targetServerTime, offsetEstimate) => {
  const now = Date.now();
  const serverNow = now + offsetEstimate;
  return Math.max(0, targetServerTime - serverNow);
};

// WebSocket request helper
export const sendWSRequest = ({ ws, request }) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(request));
  } else {
    // WebSocket not open, cannot send request - silently ignore
  }
};

// NTP measurement handling
export const handleNTPResponse = (response) => {
  const t3 = epochNow();
  const { t0, t1, t2 } = response;
  
  const roundTripDelay = t3 - t0 - (t2 - t1);
  const clockOffset = (t1 - t0 + (t2 - t3)) / 2;
  
  return {
    t0,
    t1,
    t2,
    t3,
    roundTripDelay,
    clockOffset
  };
};

export const calculateOffsetEstimate = (measurements) => {
  if (measurements.length === 0) return { averageOffset: 0, averageRoundTrip: 0 };
  
  // Sort by round trip delay and take the best half
  const sortedMeasurements = [...measurements].sort((a, b) => a.roundTripDelay - b.roundTripDelay);
  const bestMeasurements = sortedMeasurements.slice(0, Math.ceil(sortedMeasurements.length / 2));
  
  const totalOffset = bestMeasurements.reduce((sum, m) => sum + m.clockOffset, 0);
  const averageOffset = totalOffset / bestMeasurements.length;
  
  const totalRoundTrip = measurements.reduce((sum, m) => sum + m.roundTripDelay, 0);
  const averageRoundTrip = totalRoundTrip / measurements.length;
  
  return { averageOffset, averageRoundTrip };
};

// Audio synchronization utilities
export const scheduleAudioAction = (audioContext, action, when) => {
  const startTime = audioContext.currentTime + when;
  return startTime;
};

export const calculateSpatialGain = (listenerPos, sourcePos, maxDistance = 100) => {
  const distance = Math.sqrt(
    Math.pow(listenerPos.x - sourcePos.x, 2) + 
    Math.pow(listenerPos.y - sourcePos.y, 2)
  );
  
  const normalizedDistance = Math.min(distance / maxDistance, 1);
  return Math.max(0.1, 1 - normalizedDistance);
};
