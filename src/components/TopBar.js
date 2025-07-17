'use client';

import { motion } from 'framer-motion';
import { Plus, Users, Volume2, Wifi } from 'lucide-react';
import { useEffect } from 'react';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';
import ConnectionStatusIndicator from './ConnectionStatusIndicator';
import LeaveRoomButton from './LeaveRoomButton';
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
    <div className="h-20 glass-strong border-b border-border/50 flex items-center justify-between px-4 lg:px-8 relative z-20 backdrop-blur-xl">
      {/* Left side - Logo */}
      <div className="flex items-center gap-2 lg:gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <motion.div 
            className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <Volume2 className="w-6 h-6 text-white" />
          </motion.div>
          <div className="flex flex-col">
            <h1 className="text-lg lg:text-2xl font-bold bg-gradient-to-r from-white via-accent to-primary bg-clip-text text-transparent">
              BeatsSurround
            </h1>
            <p className="text-xs text-muted-foreground hidden lg:block">
              Sync your beats, amplify the vibe
            </p>
          </div>
        </motion.div>
        
        {/* Connection indicators - Desktop only */}
        <div className="hidden lg:flex items-center gap-3 ml-4">
          <div className="glass rounded-lg px-3 py-1.5 border border-border">
            <ConnectionStatusIndicator />
          </div>
          <div className="glass rounded-lg px-3 py-1.5 border border-border">
            <SyncQualityIndicator className="text-sm" />
          </div>
        </div>
      </div>

      {/* Center - Room info and detailed connection status (Desktop only) */}
      {roomId && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="hidden lg:flex items-center gap-4 glass rounded-xl px-6 py-3 border border-border shadow-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-muted-foreground">Room ID:</span>
            <Button
              variant="glass"
              size="sm"
              onClick={handleCopyRoomId}
              className="font-mono text-sm hover:bg-primary/20 border border-primary/30"
              disabled={!roomId}
            >
              {roomId || 'Loading...'}
            </Button>
          </div>
          
          <div className="w-px h-6 bg-border"></div>
          
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-accent" />
            <Badge variant="outline" className="bg-accent/10 border-accent/30 text-accent font-semibold">
              {connectedClients.length} connected
            </Badge>
          </div>
          
          {isSpatialAudioEnabled && (
            <>
              <div className="w-px h-6 bg-border"></div>
              <Badge className="bg-secondary/20 text-secondary border-secondary/30 animate-pulse-glow">
                🎧 Spatial Audio
              </Badge>
            </>
          )}
        </motion.div>
      )}

      {/* Mobile Room Info - Simplified */}
      {roomId && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex lg:hidden items-center gap-2"
        >
          <Button
            variant="glass"
            size="sm"
            onClick={handleCopyRoomId}
            className="font-mono text-xs px-3 py-2 border border-primary/30"
            disabled={!roomId}
          >
            {roomId || 'Loading...'}
          </Button>
          <Badge variant="glow" className="text-xs">
            {connectedClients.length}
          </Badge>
        </motion.div>
      )}

      {/* Right side - Actions (Desktop only) */}
      <div className="hidden lg:flex items-center gap-3">
        {roomId && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <LeaveRoomButton />
            <Button
              variant="glass"
              size="sm"
              onClick={handleNewRoom}
              className="border border-border hover:border-primary/50"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Room
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
