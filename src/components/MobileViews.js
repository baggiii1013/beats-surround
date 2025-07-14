'use client';

import { motion } from 'framer-motion';
import { Clock, Users, Volume2, Wifi } from 'lucide-react';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';
import AudioUploader from './AudioUploader';
import ConnectionStatusIndicator from './ConnectionStatusIndicator';
import Player from './Player';
import Queue from './Queue';
import RoomInfo from './RoomInfo';
import RoomJoiner from './RoomJoiner';
import { Badge } from './ui/badge';
import UserGrid from './UserGrid';

// Mobile-specific simplified room info component
function MobileRoomInfoCard() {
  const roomId = useRoomStore((state) => state.roomId);
  const username = useRoomStore((state) => state.username);
  const connectedClients = useGlobalStore((state) => state.connectedClients);
  const audioSources = useGlobalStore((state) => state.audioSources);
  const selectedAudioId = useGlobalStore((state) => state.selectedAudioId);
  const isPlaying = useGlobalStore((state) => state.isPlaying);
  
  const currentTrack = audioSources.find(source => source.id === selectedAudioId);

  return (
    <div className="space-y-4">
      {/* Room Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-blue-500/20 border border-blue-500/30">
            <Wifi className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Room {roomId}</h3>
            <p className="text-sm text-gray-400">{username}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <Badge variant="outline" className="text-sm font-medium">
            {connectedClients.length} online
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-neutral-800/50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{audioSources.length}</p>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Tracks</p>
        </div>
        <div className="bg-neutral-800/50 rounded-xl p-3 text-center">
          <ConnectionStatusIndicator showDetails={false} className="justify-center" />
          <p className="text-xs text-gray-400 uppercase tracking-wide mt-1">Connection</p>
        </div>
      </div>

      {/* Current Track */}
      {currentTrack && (
        <div className="bg-neutral-800/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-400">Now Selected</span>
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
    </div>
  );
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: "easeOut" }
};

export function MobilePlayerView() {
  return (
    <motion.div 
      {...fadeInUp}
      className="h-full overflow-y-auto pb-24 px-4"
    >
      <div className="pt-6">
        <Player />
      </div>
    </motion.div>
  );
}

export function MobileRoomView() {
  return (
    <motion.div 
      {...fadeInUp}
      className="h-full overflow-y-auto pb-24 px-4"
    >
      <div className="pt-6 space-y-4">
        {/* Simplified Room Info Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-gradient-to-br from-[#0a0015] to-[#060010] border border-neutral-700 rounded-2xl p-4 backdrop-blur-sm"
        >
          <MobileRoomInfoCard />
        </motion.div>
        
        {/* Room Actions */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-gradient-to-br from-[#0a0015] to-[#060010] border border-neutral-700 rounded-2xl p-4 backdrop-blur-sm"
        >
          <h3 className="text-lg font-semibold text-white mb-3">Room Actions</h3>
          <RoomJoiner />
        </motion.div>
        
        {/* Connected Users */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-gradient-to-br from-[#0a0015] to-[#060010] border border-neutral-700 rounded-2xl backdrop-blur-sm"
        >
          <div className="p-4 border-b border-neutral-700/50">
            <h3 className="text-lg font-semibold text-white">Connected Users</h3>
          </div>
          <UserGrid />
        </motion.div>
      </div>
    </motion.div>
  );
}

export function MobileQueueView() {
  return (
    <motion.div 
      {...fadeInUp}
      className="h-full overflow-y-auto pb-24 px-4"
    >
      <div className="pt-6 space-y-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-gradient-to-br from-[#0a0015] to-[#060010] border border-neutral-700 rounded-2xl p-4 backdrop-blur-sm"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Add Music</h3>
          <AudioUploader />
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-gradient-to-br from-[#0a0015] to-[#060010] border border-neutral-700 rounded-2xl backdrop-blur-sm"
        >
          <div className="p-4 border-b border-neutral-700/50">
            <h3 className="text-lg font-semibold text-white">Music Queue</h3>
          </div>
          <div className="p-4">
            <Queue />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function TabletPlayerView() {
  return (
    <motion.div 
      {...fadeInUp}
      className="h-full overflow-y-auto pb-24 px-6"
    >
      <div className="pt-8 max-w-4xl mx-auto">
        <Player />
      </div>
    </motion.div>
  );
}

export function TabletRoomView() {
  return (
    <motion.div 
      {...fadeInUp}
      className="h-full overflow-y-auto pb-24 px-6"
    >
      <div className="pt-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-6"
          >
            <RoomInfo />
            <RoomJoiner />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-gradient-to-br from-[#0a0015] to-[#060010] border border-neutral-700 rounded-2xl backdrop-blur-sm"
          >
            <div className="p-6 border-b border-neutral-700/50">
              <h3 className="text-xl font-semibold text-white">Connected Users</h3>
            </div>
            <UserGrid />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export function TabletQueueView() {
  return (
    <motion.div 
      {...fadeInUp}
      className="h-full overflow-y-auto pb-24 px-6"
    >
      <div className="pt-8 max-w-4xl mx-auto space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-gradient-to-br from-[#0a0015] to-[#060010] border border-neutral-700 rounded-2xl p-6 backdrop-blur-sm"
        >
          <h3 className="text-xl font-semibold text-white mb-6">Add Music</h3>
          <AudioUploader />
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-gradient-to-br from-[#0a0015] to-[#060010] border border-neutral-700 rounded-2xl backdrop-blur-sm"
        >
          <div className="p-6 border-b border-neutral-700/50">
            <h3 className="text-xl font-semibold text-white">Music Queue</h3>
          </div>
          <div className="p-6">
            <Queue />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
