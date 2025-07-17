'use client';

import { HardDrive, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGlobalStore } from '../store/global';
import { Button } from './ui/button';
import { Card } from './ui/card';

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
    <Card className="p-3 bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <div className="text-sm">
            <span className="font-medium">{stats.count}</span> cached files
            <span className="text-slate-500 dark:text-slate-400 ml-2">
              ({formatSize(stats.totalSize)})
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearExpired}
            className="text-xs px-2 py-1 h-auto"
          >
            Clear Expired
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="text-xs px-2 py-1 h-auto text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        </div>
      </div>
      
      {stats.count > 0 && (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Audio files are cached for faster loading after page refresh
        </div>
      )}
    </Card>
  );
}
