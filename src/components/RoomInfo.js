'use client';

import { Clock, Users, Volume2, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';
import AudioCacheStatus from './AudioCacheStatus';
import ConnectionStatusIndicator from './ConnectionStatusIndicator';
import SyncQualityIndicator from './SyncQualityIndicator';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

const RoomInfo = ({ className = '' }) => {
  const roomId = useRoomStore((state) => state.roomId);
  const username = useRoomStore((state) => state.username);
  const connectedClients = useGlobalStore((state) => state.connectedClients);
  const connectionStatus = useGlobalStore((state) => state.connectionStatus);
  const syncQuality = useGlobalStore((state) => state.syncQuality);
  const isSynced = useGlobalStore((state) => state.isSynced);
  const audioSources = useGlobalStore((state) => state.audioSources);
  const selectedAudioId = useGlobalStore((state) => state.selectedAudioId);
  const isPlaying = useGlobalStore((state) => state.isPlaying);
  
  const [roomUptime, setRoomUptime] = useState(0);

  // Update room uptime
  useEffect(() => {
    if (!connectionStatus.connectionStartTime) return;
    
    const interval = setInterval(() => {
      setRoomUptime(Date.now() - connectionStatus.connectionStartTime);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [connectionStatus.connectionStartTime]);

  const formatDuration = (ms) => {
    if (ms < 1000) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const currentTrack = audioSources.find(source => source.id === selectedAudioId);

  if (!roomId) return null;

  return (
    <Card className={`p-4 bg-black/40 backdrop-blur-md border-gray-800 ${className}`}>
      <div className="space-y-4">
        {/* Room Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-semibold text-white">Room {roomId}</h3>
              <p className="text-sm text-gray-400">Connected as {username}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <Badge variant="outline" className="text-xs">
              {connectedClients.length} online
            </Badge>
          </div>
        </div>

        {/* Connection Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Connection</span>
            <ConnectionStatusIndicator showDetails={false} />
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Sync Status</span>
            <SyncQualityIndicator className="text-xs" />
          </div>
        </div>

        {/* Room Stats */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-400">Uptime</span>
            <p className="text-white font-mono">{formatDuration(roomUptime)}</p>
          </div>
          
          <div>
            <span className="text-gray-400">Audio Sources</span>
            <p className="text-white font-mono">{audioSources.length}</p>
          </div>
          
          <div>
            <span className="text-gray-400">Messages</span>
            <p className="text-white font-mono">
              {(connectionStatus.messagesReceived || 0) + (connectionStatus.messagesSent || 0)}
            </p>
          </div>
          
          <div>
            <span className="text-gray-400">Data Transfer</span>
            <p className="text-white font-mono">
              {Math.round(((connectionStatus.bytesReceived || 0) + (connectionStatus.bytesSent || 0)) / 1024)}KB
            </p>
          </div>
          
          {connectionStatus.reconnectCount > 0 && (
            <>
              <div>
                <span className="text-gray-400">Reconnects</span>
                <p className="text-white font-mono">{connectionStatus.reconnectCount}</p>
              </div>
            </>
          )}
        </div>

        {/* Current Track Info */}
        {currentTrack && (
          <div className="border-t border-gray-800 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-400">Selected</span>
              {isPlaying && (
                <Badge className="text-xs bg-green-500/20 text-green-300 border-green-500/30">
                  Playing
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium text-white truncate">
              {currentTrack.metadata?.title || currentTrack.name}
            </p>
            {currentTrack.metadata?.artist && (
              <p className="text-xs text-gray-400 truncate">
                {currentTrack.metadata.artist}
              </p>
            )}
          </div>
        )}

        {/* Detailed Connection Metrics */}
        <div className="border-t border-gray-800 pt-3">
          <ConnectionStatusIndicator showDetails={true} className="text-xs" />
        </div>

        {/* Audio Cache Status */}
        <div className="border-t border-gray-800 pt-3">
          <AudioCacheStatus />
        </div>
      </div>
    </Card>
  );
};

export default RoomInfo;
