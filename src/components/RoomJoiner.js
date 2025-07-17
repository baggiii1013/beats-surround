'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Users, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { API_URL } from '../config/websocket';
import { generateRoomId } from '../lib/utils';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export default function RoomJoiner() {
  const [roomIdInput, setRoomIdInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Room state
  const roomId = useRoomStore((state) => state.roomId);
  const generateNewRoomId = useRoomStore((state) => state.generateNewRoomId);
  const setRoomId = useRoomStore((state) => state.setRoomId);
  const initialize = useRoomStore((state) => state.initialize);
  
  // Global state
  const connectedClients = useGlobalStore((state) => state.connectedClients);
  const isSynced = useGlobalStore((state) => state.isSynced);
  const socket = useGlobalStore((state) => state.socket);
  const resetStore = useGlobalStore((state) => state.resetStore);
  const roundTripEstimate = useGlobalStore((state) => state.roundTripEstimate);
  
  // Initialize room store on client side
  useEffect(() => {
    // Always initialize to ensure username is set
    initialize();
  }, [initialize]);
  
  const handleJoinRoom = async () => {
    if (!roomIdInput.trim()) {
      toast.error('Please enter a room ID');
      return;
    }
    
    setIsJoining(true);
    
    try {
      // Normalize room ID to uppercase for consistency
      const normalizedRoomId = roomIdInput.trim().toUpperCase();
      
      // Validate room exists by checking with server
      const response = await fetch(`${API_URL}/api/rooms/${normalizedRoomId}`);
      
      if (response.ok) {
        const roomData = await response.json();
        
        // Room exists, join it
        resetStore(); // Reset current state
        
        // Ensure username is set after reset with a small delay
        setTimeout(() => {
          initialize();
          setRoomId(normalizedRoomId);
        }, 100);
        
        setShowJoinForm(false);
        setRoomIdInput('');
        toast.success(`Joined room ${normalizedRoomId}`);
      } else if (response.status === 404) {
        toast.error('Room not found. Please check the room ID.');
      } else {
        toast.error('Failed to join room. Please try again.');
      }
    } catch (error) {
      toast.error('Connection error. Please check your network.');
    } finally {
      setIsJoining(false);
    }
  };
  
  const handleCreateNewRoom = async () => {
    try {
      resetStore();
      
      // Ensure username is set after reset with a small delay
      setTimeout(() => {
        initialize();
      }, 100);
      
      // Create room on server
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setTimeout(() => {
          setRoomId(data.roomId);
        }, 150);
        toast.success(`Created new room: ${data.roomId}`);
      } else {
        // Fallback to client-side generation
        const newRoomId = generateNewRoomId();
        setTimeout(() => {
          setRoomId(newRoomId);
        }, 150);
        toast.success(`Created new room: ${newRoomId}`);
      }
    } catch (error) {
      // Fallback to client-side generation
      const newRoomId = generateNewRoomId();
      setTimeout(() => {
        setRoomId(newRoomId);
      }, 150);
      toast.success(`Created new room: ${newRoomId}`);
    }
  };
  
  const handleCopyRoomId = async () => {
    if (!roomId) return;
    
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      toast.success('Room ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy room ID');
    }
  };
  
  const getConnectionStatus = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return { status: 'disconnected', color: 'text-red-400', icon: WifiOff };
    }
    if (!isSynced) {
      return { status: 'connecting', color: 'text-yellow-400', icon: Wifi };
    }
    return { status: 'connected', color: 'text-green-400', icon: Wifi };
  };
  
  const connectionStatus = getConnectionStatus();
  const ConnectionIcon = connectionStatus.icon;
  
  return (
    <div className="glass rounded-xl p-4 border border-border shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-lg">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Room</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ConnectionIcon className={`w-4 h-4 ${connectionStatus.color}`} />
              <span className="capitalize">{connectionStatus.status}</span>
              {isSynced && roundTripEstimate > 0 && (
                <span className="text-xs hidden sm:inline">
                  (±{Math.round(roundTripEstimate)}ms)
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={() => setShowJoinForm(!showJoinForm)}
            className="text-sm border border-border hover:border-primary/50"
          >
            Join Room
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={handleCreateNewRoom}
            className="text-sm border border-border hover:border-primary/50"
          >
            New Room
          </Button>
        </div>
      </div>
      
      {/* Current Room Info */}
      {roomId && (
        <div className="mb-4 p-3 glass rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Current Room ID</div>
              <div className="flex items-center gap-2">
                <code className="text-lg font-mono font-bold text-white glass px-2 py-1 rounded border border-primary/30">
                  {roomId}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyRoomId}
                  className="p-2 h-8 w-8 hover:bg-primary/20"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground hover:text-white" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Connected Users</div>
              <Badge variant="glow" className="text-sm">
                {connectedClients.length + 1} {/* +1 for current user */}
              </Badge>
            </div>
          </div>
        </div>
      )}
      
      {/* Join Room Form */}
      <AnimatePresence>
        {showJoinForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="p-3 glass rounded-lg border border-border">
              <div className="text-sm text-muted-foreground mb-2">Enter Room ID</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                  placeholder="e.g., ABC123"
                  className="flex-1 px-3 py-2 glass border border-input-border rounded-lg text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-w-0"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleJoinRoom();
                    }
                  }}
                  disabled={isJoining}
                />
                <Button
                  onClick={handleJoinRoom}
                  disabled={isJoining || !roomIdInput.trim()}
                  className="px-4 w-full sm:w-auto flex-shrink-0"
                >
                  {isJoining ? 'Joining...' : 'Join'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Connected Clients List */}
      {connectedClients.length > 0 && (
        <div>
          <div className="text-sm text-muted-foreground mb-2">Connected Users</div>
          <div className="space-y-2">
            {connectedClients.map((client) => (
              <div
                key={client.clientId}
                className="flex items-center gap-3 p-2 glass rounded-lg border border-border"
              >
                <div className="w-6 h-6 bg-gradient-accent rounded-full flex items-center justify-center shadow-lg">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">
                    {client.username || `User ${client.clientId.slice(0, 6)}`}
                  </div>
                  <div className="text-xs text-muted-foreground hidden sm:block">
                    {client.rtt > 0 && `${client.rtt}ms`}
                  </div>
                </div>
                <Badge
                  variant={client.isActive ? "success" : "secondary"}
                  className="text-xs"
                >
                  {client.isActive ? 'Active' : 'Idle'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
