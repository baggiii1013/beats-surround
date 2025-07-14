'use client';

import { Signal, SignalHigh, SignalLow, SignalMedium, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGlobalStore } from '../store/global';
import { Badge } from './ui/badge';

const ConnectionStatusIndicator = ({ className = '', showDetails = false }) => {
  const connectionStatus = useGlobalStore((state) => state.connectionStatus);
  const socket = useGlobalStore((state) => state.socket);
  const roundTripEstimate = useGlobalStore((state) => state.roundTripEstimate);
  
  // Calculate connection strength based on ping and connection stability
  const getConnectionStrength = () => {
    if (!connectionStatus.isConnected || !socket) return 'unknown';
    
    const ping = connectionStatus.ping || roundTripEstimate;
    const packetLoss = connectionStatus.packetLoss || 0;
    
    if (ping < 50 && packetLoss < 1) return 'excellent';
    if (ping < 100 && packetLoss < 3) return 'good';
    if (ping < 200 && packetLoss < 5) return 'fair';
    return 'poor';
  };

  const getSignalIcon = (strength) => {
    switch (strength) {
      case 'excellent': return <SignalHigh className="w-4 h-4" />;
      case 'good': return <SignalMedium className="w-4 h-4" />;
      case 'fair': return <SignalLow className="w-4 h-4" />;
      case 'poor': return <Signal className="w-4 h-4" />;
      default: return connectionStatus.isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />;
    }
  };

  const getStatusColor = (strength) => {
    if (!connectionStatus.isConnected) return 'bg-red-500 text-white';
    
    switch (strength) {
      case 'excellent': return 'bg-green-500 text-white';
      case 'good': return 'bg-blue-500 text-white';
      case 'fair': return 'bg-yellow-500 text-black';
      case 'poor': return 'bg-orange-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const strength = getConnectionStrength();
  const ping = connectionStatus.ping || roundTripEstimate || 0;

  if (!showDetails) {
    // Compact version for mobile/small spaces
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {getSignalIcon(strength)}
        <span className="text-xs text-gray-400">
          {connectionStatus.isConnected ? `${Math.round(ping)}ms` : 'Offline'}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Connection status badge */}
      <div className="flex items-center gap-2">
        {getSignalIcon(strength)}
        <Badge className={getStatusColor(strength)}>
          {connectionStatus.isConnected ? 
            strength.charAt(0).toUpperCase() + strength.slice(1) : 
            'Offline'
          }
        </Badge>
      </div>
      
      {/* Connection metrics */}
      {connectionStatus.isConnected && (
        <div className="text-xs text-gray-600 dark:text-gray-400 flex gap-3">
          <span>Ping: {Math.round(ping)}ms</span>
          
          {connectionStatus.packetLoss > 0 && (
            <span>Loss: {connectionStatus.packetLoss.toFixed(1)}%</span>
          )}
          
          {connectionStatus.uptime > 0 && (
            <span>Up: {formatDuration(connectionStatus.uptime)}</span>
          )}
          
          {(connectionStatus.messagesReceived > 0 || connectionStatus.messagesSent > 0) && (
            <span>
              Msgs: {connectionStatus.messagesReceived}↓ {connectionStatus.messagesSent}↑
            </span>
          )}
          
          {connectionStatus.reconnectCount > 0 && (
            <span>Reconnects: {connectionStatus.reconnectCount}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatusIndicator;
