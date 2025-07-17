'use client';

import { motion } from 'framer-motion';
import { FileAudio, HardDrive, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGlobalStore } from '../store/global';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export default function AudioCacheStatus() {
  const [stats, setStats] = useState({ count: 0, totalSize: 0 });
  const [isVisible, setIsVisible] = useState(false);
  
  const clearAudioCache = useGlobalStore((state) => state.clearAudioCache);
  const clearExpiredCache = useGlobalStore((state) => state.clearExpiredCache);
  const getCacheStats = useGlobalStore((state) => state.getCacheStats);

  const updateStats = async () => {
    try {
      const cacheStats = await getCacheStats();
      setStats(cacheStats);
    } catch (error) {
      setStats({ count: 0, totalSize: 0 });
    }
  };

  useEffect(() => {
    updateStats();
    // Update stats every 30 seconds
    const interval = setInterval(updateStats, 30000);
    return () => clearInterval(interval);
  }, [getCacheStats]);

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleClearExpired = async () => {
    await clearExpiredCache();
    updateStats();
  };

  const handleClearAll = async () => {
    await clearAudioCache();
    updateStats();
  };

  // Only show if there are cached files or in development
  if (stats.count === 0 && process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-gradient-to-br from-[#0a0015] to-[#060010] border border-neutral-700 rounded-2xl p-4 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
            <HardDrive className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Audio Cache</h3>
            <p className="text-xs text-muted-foreground">Cached for faster loading</p>
          </div>
        </div>
        
        <Badge variant="glow" className="text-xs">
          {stats.count} files
        </Badge>
      </div>

      {/* Stats Display */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass rounded-xl p-3 text-center border border-border">
          <div className="flex items-center justify-center gap-1 mb-1">
            <FileAudio className="w-3 h-3 text-accent" />
          </div>
          <p className="text-lg font-bold bg-gradient-to-r from-white to-accent bg-clip-text text-transparent">
            {stats.count}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Files</p>
        </div>
        
        <div className="glass rounded-xl p-3 text-center border border-border">
          <div className="flex items-center justify-center gap-1 mb-1">
            <HardDrive className="w-3 h-3 text-cyan-400" />
          </div>
          <p className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            {formatSize(stats.totalSize)}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Size</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="glass"
          size="sm"
          onClick={handleClearExpired}
          className="flex-1 text-xs h-8 border border-border hover:border-primary/50 transition-all duration-200"
        >
          Clear Expired
        </Button>
        
        <Button
          variant="glass"
          size="sm"
          onClick={handleClearAll}
          className="flex-1 text-xs h-8 text-red-400 hover:text-red-300 border border-border hover:border-red-400/50 transition-all duration-200"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear All
        </Button>
      </div>
      
      {stats.count > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-3 text-xs text-muted-foreground text-center bg-gradient-to-r from-transparent via-neutral-700/20 to-transparent p-2 rounded-lg"
        >
          Audio files cached for instant playback after refresh
        </motion.div>
      )}
    </motion.div>
  );
}
