import { Badge } from '@/components/ui/badge';
import { useGlobalStore } from '@/store/global';
import React from 'react';

const SyncQualityIndicator = ({ className = '' }) => {
  const syncQuality = useGlobalStore((state) => state.syncQuality);
  const isSynced = useGlobalStore((state) => state.isSynced);

  // Safety check - provide default values if syncQuality is incomplete
  const safeQuality = {
    latency: 0,
    jitter: 0,
    accuracy: 0,
    clockDrift: 0,
    qualityLevel: 'unknown',
    lastUpdate: 0,
    ...syncQuality
  };

  const getQualityColor = (level) => {
    switch (level) {
      case 'excellent': return 'bg-green-500 text-white';
      case 'good': return 'bg-blue-500 text-white';
      case 'fair': return 'bg-yellow-500 text-black';
      case 'poor': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatLatency = (latency) => {
    if (latency < 1) return `${(latency * 1000).toFixed(1)}μs`;
    if (latency < 1000) return `${latency.toFixed(1)}ms`;
    return `${(latency / 1000).toFixed(2)}s`;
  };

  const formatDrift = (drift) => {
    const absDrift = Math.abs(drift);
    if (absDrift < 0.001) return `${(absDrift * 1000000).toFixed(1)}μs/s`;
    if (absDrift < 1) return `${(absDrift * 1000).toFixed(1)}ms/s`;
    return `${absDrift.toFixed(2)}s/s`;
  };

  if (!isSynced) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="secondary" className="bg-gray-500 text-white">
          Not Synced
        </Badge>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge className={getQualityColor(safeQuality.qualityLevel)}>
        {safeQuality.qualityLevel.charAt(0).toUpperCase() + safeQuality.qualityLevel.slice(1)} Sync
      </Badge>
      
      <div className="text-xs text-gray-600 dark:text-gray-400 flex gap-3">
        <span>Latency: {formatLatency(safeQuality.latency)}</span>
        <span>Jitter: {formatLatency(safeQuality.jitter)}</span>
        <span>Accuracy: {(safeQuality.accuracy * 100).toFixed(1)}%</span>
        {safeQuality.clockDrift !== 0 && (
          <span>Drift: {formatDrift(safeQuality.clockDrift)}</span>
        )}
      </div>
    </div>
  );
};

export default SyncQualityIndicator;
