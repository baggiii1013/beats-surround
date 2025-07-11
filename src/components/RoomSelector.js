'use client';

import { motion } from 'framer-motion';
import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { API_URL } from '../config/websocket';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';
import { Button } from './ui/button';

export default function RoomSelector() {
  const [roomIdInput, setRoomIdInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const generateNewRoomId = useRoomStore((state) => state.generateNewRoomId);
  const setRoomId = useRoomStore((state) => state.setRoomId);
  const resetStore = useGlobalStore((state) => state.resetStore);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    
    try {
      resetStore();
      
      // Try to create room on server
      const response = await fetch(`${API_URL}/api/rooms`, {
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
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomIdInput.trim()) {
      toast.error('Please enter a room ID');
      return;
    }
    
    setIsJoining(true);
    
    try {
      // Validate room exists by checking with server
      const response = await fetch(`${API_URL}/api/rooms/${roomIdInput.trim()}`);
      
      if (response.ok) {
        // Room exists, join it
        resetStore();
        setRoomId(roomIdInput.trim().toUpperCase());
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/40 backdrop-blur-sm border border-gray-700 rounded-xl p-8 max-w-md w-full"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to BeatsSurround</h1>
          <p className="text-gray-400">Choose how you&apos;d like to get started</p>
        </div>

        <div className="space-y-4">
          {/* Create New Room */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={handleCreateRoom}
              disabled={isCreating || isJoining}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-6 text-lg font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" />
              {isCreating ? 'Creating Room...' : 'Create New Room'}
            </Button>
          </motion.div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-black/40 text-gray-400">or</span>
            </div>
          </div>

          {/* Join Existing Room */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={6}
              disabled={isJoining || isCreating}
            />
            <Button
              onClick={handleJoinRoom}
              disabled={!roomIdInput.trim() || isJoining || isCreating}
              variant="outline"
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-800 py-3"
            >
              <Users className="w-4 h-4 mr-2" />
              {isJoining ? 'Joining...' : 'Join Room'}
            </Button>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Room IDs are 6 characters long and case-insensitive</p>
        </div>
      </motion.div>
    </div>
  );
}
