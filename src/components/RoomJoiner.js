'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Users, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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
    if (!roomId) {
      initialize();
    }
  }, [roomId, initialize]);
  
  const handleJoinRoom = async () => {
    if (!roomIdInput.trim()) {
      toast.error('Please enter a room ID');
      return;
    }
    
    setIsJoining(true);
    
    try {
      // Validate room exists by checking with server
      const response = await fetch(`http://localhost:8080/api/rooms/${roomIdInput.trim()}`);
      
      if (response.ok) {
        // Room exists, join it
        resetStore(); // Reset current state
        setRoomId(roomIdInput.trim().toUpperCase());
        setShowJoinForm(false);
        setRoomIdInput('');
        toast.success(`Joined room ${roomIdInput.trim().toUpperCase()}`);
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
      
      // Create room on server
      const response = await fetch('http://localhost:8080/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoomId(data.roomId);
        toast.success(`Created new room: ${data.roomId}`);
      } else {
        // Fallback to client-side generation
        const newRoomId = generateNewRoomId();
        setRoomId(newRoomId);
        toast.success(`Created new room: ${newRoomId}`);
      }
    } catch (error) {
      // Fallback to client-side generation
      const newRoomId = generateNewRoomId();
      setRoomId(newRoomId);
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
    <div className="bg-black/40 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Room</h2>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <ConnectionIcon className={`w-4 h-4 ${connectionStatus.color}`} />
              <span className="capitalize">{connectionStatus.status}</span>
              {isSynced && roundTripEstimate > 0 && (
                <span className="text-xs">
                  (±{Math.round(roundTripEstimate)}ms)
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowJoinForm(!showJoinForm)}
            className="text-sm"
          >
            Join Room
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateNewRoom}
            className="text-sm"
          >
            New Room
          </Button>
        </div>
      </div>
      
      {/* Current Room Info */}
      {roomId && (
        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400 mb-1">Current Room ID</div>
              <div className="flex items-center gap-2">
                <code className="text-lg font-mono font-bold text-white bg-gray-700 px-2 py-1 rounded">
                  {roomId}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyRoomId}
                  className="p-2 h-8 w-8"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-gray-400 mb-1">Connected Users</div>
              <Badge variant="outline" className="text-sm">
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
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Enter Room ID</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                  placeholder="e.g., ABC123"
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="px-4"
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
          <div className="text-sm text-gray-400 mb-2">Connected Users</div>
          <div className="space-y-2">
            {connectedClients.map((client) => (
              <div
                key={client.clientId}
                className="flex items-center gap-3 p-2 bg-gray-800/30 rounded-lg"
              >
                <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">
                    {client.username || `User ${client.clientId.slice(0, 6)}`}
                  </div>
                  <div className="text-xs text-gray-400">
                    {client.rtt > 0 && `${client.rtt}ms`}
                  </div>
                </div>
                <Badge
                  variant={client.isActive ? "default" : "secondary"}
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
