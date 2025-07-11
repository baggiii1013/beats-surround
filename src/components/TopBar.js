'use client';

import { motion } from 'framer-motion';
import { Users, Volume2, Wifi } from 'lucide-react';
import { useEffect } from 'react';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';
import SyncQualityIndicator from './SyncQualityIndicator';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export default function TopBar() {
  const roomId = useRoomStore((state) => state.roomId);
  const generateNewRoomId = useRoomStore((state) => state.generateNewRoomId);
  const initialize = useRoomStore((state) => state.initialize);
  const connectedClients = useGlobalStore((state) => state.connectedClients);
  const isInitingSystem = useGlobalStore((state) => state.isInitingSystem);
  const isSpatialAudioEnabled = useGlobalStore((state) => state.isSpatialAudioEnabled);
  const resetStore = useGlobalStore((state) => state.resetStore);
  const socket = useGlobalStore((state) => state.socket);
  const isSynced = useGlobalStore((state) => state.isSynced);

  // Initialize room store on client side (without auto room creation)
  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleNewRoom = () => {
    const newRoomId = generateNewRoomId();
    resetStore();
  };

  const handleCopyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      // Could show a toast here
    }
  };

  return (
    <div className="h-16 bg-black/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-6">
      {/* Left side - Logo */}
      <div className="flex items-center gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">BeatsSurround</h1>
        </motion.div>
        
        <SyncQualityIndicator className="text-sm" />
      </div>

      {/* Center - Room info */}
      {roomId && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300">Room:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyRoomId}
              className="font-mono text-sm"
              disabled={!roomId}
            >
              {roomId || 'Loading...'}
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <Badge variant="outline" className="text-xs">
              {connectedClients.length} {/* Current user count */}
            </Badge>
          </div>
          
          {isSpatialAudioEnabled && (
            <Badge className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">
              Spatial Audio
            </Badge>
          )}
        </div>
      )}

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {roomId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewRoom}
            className="text-sm"
          >
            New Room
          </Button>
        )}
      </div>
    </div>
  );
}
