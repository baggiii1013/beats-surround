'use client';

import { motion } from 'framer-motion';
import { Radio, Volume2, Waves } from 'lucide-react';
import { cn } from '../lib/utils';
import { useGlobalStore } from '../store/global';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

export default function SpatialAudioBackground() {
  const spatialConfig = useGlobalStore((state) => state.spatialConfig);
  const isSpatialAudioEnabled = useGlobalStore((state) => state.isSpatialAudioEnabled);
  const connectedClients = useGlobalStore((state) => state.connectedClients);
  
  // Mock gain value for visual effect
  const gain = isSpatialAudioEnabled ? 0.8 : 0.2;

  return (
    <Card className="p-4 bg-black/40 backdrop-blur-md border-gray-800">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <Waves className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Spatial Audio</h3>
              <p className="text-xs text-gray-400">3D Sound Environment</p>
            </div>
          </div>
          
          <Badge variant={isSpatialAudioEnabled ? "success" : "outline"} className="text-xs">
            {isSpatialAudioEnabled ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Visualizer */}
        <div className="relative h-32 bg-gradient-to-br from-purple-600/10 to-pink-600/10 rounded-xl border border-purple-500/20 overflow-hidden">
          {/* Animated Background */}
          <motion.div
            animate={{
              opacity: [0.3, 0.7, 0.3],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 blur-xl"
          />

          {/* Audio Nodes */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-20 h-20">
              {/* Center Node */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center"
              >
                <Volume2 className="w-6 h-6 text-white" />
              </motion.div>

              {/* Surrounding Nodes */}
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [0.8, 1, 0.8],
                    opacity: [0.4, 0.8, 0.4],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.5,
                  }}
                  className="absolute w-3 h-3 bg-cyan-400 rounded-full"
                  style={{
                    top: `${30 + 40 * Math.sin(i * Math.PI / 2)}%`,
                    left: `${30 + 40 * Math.cos(i * Math.PI / 2)}%`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Status Text */}
          <div className="absolute bottom-2 left-2">
            <p className="text-xs text-purple-300">
              {isSpatialAudioEnabled ? 'Immersive audio active' : 'Standard audio mode'}
            </p>
          </div>
        </div>

        {/* Audio Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {Math.round(gain * 100)}%
            </p>
            <p className="text-xs text-gray-400">Spatial Gain</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {connectedClients.length}
            </p>
            <p className="text-xs text-gray-400">Audio Nodes</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
