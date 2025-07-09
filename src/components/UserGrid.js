'use client';

import { motion } from 'framer-motion';
import { HeadphonesIcon, Users } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Switch } from './ui/switch';

export default function UserGrid({ className, ...rest }) {
  const connectedClients = useGlobalStore((state) => state.connectedClients);
  const isSpatialAudioEnabled = useGlobalStore((state) => state.isSpatialAudioEnabled);
  const setIsSpatialAudioEnabled = useGlobalStore((state) => state.setIsSpatialAudioEnabled);
  const listeningSourcePosition = useGlobalStore((state) => state.listeningSourcePosition);
  const updateListeningSource = useGlobalStore((state) => state.updateListeningSource);
  const setIsDraggingListeningSource = useGlobalStore((state) => state.setIsDraggingListeningSource);
  const startSpatialAudio = useGlobalStore((state) => state.startSpatialAudio);
  const stopSpatialAudio = useGlobalStore((state) => state.sendStopSpatialAudio);

  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setIsDraggingListeningSource(true);
    handleMouseMove(e);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    updateListeningSource({ 
      x: Math.max(0, Math.min(100, x)), 
      y: Math.max(0, Math.min(100, y)) 
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsDraggingListeningSource(false);
  };

  // Mock connected clients for demo
  const mockClients = [
    { id: '1', name: 'John Doe', x: 20, y: 30, isActive: true },
    { id: '2', name: 'Jane Smith', x: 70, y: 60, isActive: false },
    { id: '3', name: 'Bob Johnson', x: 40, y: 80, isActive: true },
  ];

  const clients = connectedClients.length > 0 ? connectedClients : mockClients;

  return (
    <div className={cn("h-full flex flex-col", className)} {...rest}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Spatial Audio</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {clients.length}
          </Badge>
          <Switch
            checked={isSpatialAudioEnabled}
            onCheckedChange={(checked) => {
              setIsSpatialAudioEnabled(checked);
              if (checked) {
                startSpatialAudio();
              } else {
                stopSpatialAudio();
              }
            }}
          />
        </div>
      </div>

      {/* 2D Grid */}
      <div className="flex-1 p-4 flex flex-col min-h-0">
        {clients.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No other users connected</p>
          </div>
        ) : (
          <div
            className="relative flex-1 bg-gray-900/50 border border-gray-700 rounded-lg overflow-hidden cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Grid background */}
            <div className="absolute inset-0 opacity-10">
              <div className="h-full w-full grid grid-cols-8 grid-rows-8 gap-px">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div key={i} className="border border-gray-600" />
                ))}
              </div>
            </div>

            {/* Connected users */}
            {clients.map((client) => (
              <motion.div
                key={client.id}
                className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${client.x}%`,
                  top: `${client.y}%`,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className={cn(
                  "w-full h-full rounded-full flex items-center justify-center text-xs font-medium text-white",
                  client.isActive ? "bg-green-500" : "bg-gray-500"
                )}>
                  {client.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap">
                  {client.name}
                </div>
              </motion.div>
            ))}

            {/* Listening source */}
            <motion.div
              className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 cursor-move"
              style={{
                left: `${listeningSourcePosition.x}%`,
                top: `${listeningSourcePosition.y}%`,
                opacity: isSpatialAudioEnabled ? 1 : 0.7,
              }}
              animate={!isDragging ? {
                left: `${listeningSourcePosition.x}%`,
                top: `${listeningSourcePosition.y}%`,
                opacity: isSpatialAudioEnabled ? 1 : 0.7,
              } : {}}
              transition={{
                type: "tween",
                duration: 0.15,
                ease: "linear",
              }}
            >
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-blue-400/20 p-1">
                <span className="relative flex h-3 w-3">
                  {isSpatialAudioEnabled && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-blue-200 opacity-75 animate-ping" />
                  )}
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                </span>
                <HeadphonesIcon className="absolute h-2 w-2 text-blue-100 opacity-80" />
              </div>
            </motion.div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-4 text-xs text-gray-400">
          <p>• Drag the listening source to change spatial audio position</p>
          <p>• User dots represent connected devices</p>
          <p>• Green dots are actively playing audio</p>
        </div>
      </div>
    </div>
  );
}
