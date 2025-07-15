'use client';

import { Activity, AlertTriangle, CheckCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';

export default function CleanupMonitor() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [orphanScan, setOrphanScan] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Fetch cleanup status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/cleanup/status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data);
        setLastUpdate(new Date());
      } else {
        toast.error(`Failed to fetch status: ${data.error}`);
      }
    } catch (error) {
      toast.error(`Network error: ${error.message}`);
    }
  };

  // Scan for orphaned rooms
  const scanOrphans = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cleanup/orphans/scan');
      const data = await response.json();
      
      if (data.success) {
        setOrphanScan(data);
        toast.success(`Scan complete: ${data.result.orphanedRooms.length} orphaned rooms found`);
      } else {
        toast.error(`Scan failed: ${data.error}`);
      }
    } catch (error) {
      toast.error(`Scan error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Clean up orphaned rooms
  const cleanupOrphans = async (dryRun = true) => {
    setLoading(true);
    const action = dryRun ? 'Dry run' : 'Cleanup';
    
    try {
      const response = await fetch(`/api/cleanup/orphans?dryRun=${dryRun}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setOrphanScan(data);
        
        if (dryRun) {
          toast.success(`${action} complete: ${data.result.orphanedRooms.length} rooms would be deleted`);
        } else {
          toast.success(`${action} complete: ${data.result.deletedFiles} files deleted from ${data.result.orphanedRooms.length} rooms`);
        }
        
        // Refresh status after cleanup
        await fetchStatus();
      } else {
        toast.error(`${action} failed: ${data.error}`);
      }
    } catch (error) {
      toast.error(`${action} error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (!status) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading cleanup status...</span>
        </div>
      </Card>
    );
  }

  const { health, stats } = status;

  return (
    <div className="space-y-6">
      {/* System Health */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Cleanup System Health
          </h3>
          
          <div className="flex items-center gap-2">
            {health.healthy ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                Healthy
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Issues Detected
              </Badge>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchStatus}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {!health.healthy && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 font-medium">Issues found:</p>
            <ul className="text-red-600 text-sm mt-1">
              {health.issues.map((issue, index) => (
                <li key={index}>• {issue}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.totalCleanups}</div>
            <div className="text-sm text-gray-600">Total Cleanups</div>
          </div>
          
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.successfulCleanups}</div>
            <div className="text-sm text-gray-600">Successful</div>
          </div>
          
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.failedCleanups}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
          
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{stats.filesDeleted}</div>
            <div className="text-sm text-gray-600">Files Deleted</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium">Active Timers:</span> {stats.activeCleanupTimers}
          </div>
          <div>
            <span className="font-medium">Active Operations:</span> {stats.activeCleanupOperations}
          </div>
          <div>
            <span className="font-medium">Grace Period:</span> {formatDuration(stats.config.CLEANUP_GRACE_PERIOD)}
          </div>
        </div>

        {stats.lastOrphanCheck && (
          <div className="mt-2 text-sm text-gray-600">
            Last orphan check: {new Date(stats.lastOrphanCheck).toLocaleString()}
          </div>
        )}
      </Card>

      {/* Orphan Management */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Orphaned Room Management
          </h3>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={scanOrphans}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Scan
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => cleanupOrphans(true)}
              disabled={loading}
            >
              Dry Run
            </Button>
            
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => {
                if (confirm('Are you sure you want to delete orphaned rooms? This cannot be undone.')) {
                  cleanupOrphans(false);
                }
              }}
              disabled={loading}
            >
              Clean Up
            </Button>
          </div>
        </div>

        {orphanScan && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline">
                Mode: {orphanScan.mode}
              </Badge>
              <span>Active rooms: {orphanScan.activeRoomsInMemory || 'N/A'}</span>
              <span>Scan time: {new Date(orphanScan.timestamp).toLocaleString()}</span>
            </div>

            {orphanScan.result && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-xl font-bold text-yellow-700">
                    {orphanScan.result.orphanedRooms.length}
                  </div>
                  <div className="text-sm text-yellow-600">Orphaned Rooms</div>
                </div>
                
                <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xl font-bold text-blue-700">
                    {orphanScan.result.totalFiles}
                  </div>
                  <div className="text-sm text-blue-600">Total Files</div>
                </div>
                
                {orphanScan.result.deletedFiles !== undefined && (
                  <div className="text-center p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-xl font-bold text-green-700">
                      {orphanScan.result.deletedFiles}
                    </div>
                    <div className="text-sm text-green-600">Files Deleted</div>
                  </div>
                )}
              </div>
            )}

            {orphanScan.result?.orphanedRooms.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Orphaned Rooms:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {orphanScan.result.orphanedRooms.map((room, index) => (
                    <div key={index} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                      <span className="font-mono">{room.roomId}</span>
                      <span className="text-gray-600">{room.fileCount} files</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {orphanScan.result?.errors?.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2 text-red-600">Errors:</h4>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {orphanScan.result.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {lastUpdate && (
          <div className="mt-4 text-xs text-gray-500">
            Last updated: {lastUpdate.toLocaleString()}
          </div>
        )}
      </Card>
    </div>
  );
}
