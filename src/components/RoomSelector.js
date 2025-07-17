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
  const resetAudioForRoom = useGlobalStore((state) => state.resetAudioForRoom);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    
    try {
      // Reset audio state for new room
      resetAudioForRoom();
      
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
        resetAudioForRoom();
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
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--background-secondary))] to-[hsl(var(--background-tertiary))] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass-strong rounded-2xl p-8 max-w-md w-full shadow-2xl relative z-10"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl animate-pulse-glow"
          >
            <Users className="w-10 h-10 text-white" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold bg-gradient-to-r from-white via-accent to-primary bg-clip-text text-transparent mb-3"
          >
            BeatsSurround
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground text-lg"
          >
            Sync your music, amplify the vibe
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-6"
        >
          {/* Create New Room */}
          <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Button
              onClick={handleCreateRoom}
              disabled={isCreating || isJoining}
              size="lg"
              className="w-full text-lg font-semibold h-14 shadow-xl hover:shadow-2xl"
            >
              <Plus className="w-6 h-6 mr-3" />
              {isCreating ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Creating Room...
                </div>
              ) : (
                'Create New Room'
              )}
            </Button>
          </motion.div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 glass text-muted-foreground rounded-full border border-border">or join existing</span>
            </div>
          </div>

          {/* Join Existing Room */}
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Enter 6-character Room ID"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                className="w-full px-6 py-4 glass rounded-xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-lg font-mono tracking-wider text-center"
                maxLength={6}
                disabled={isJoining || isCreating}
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none"></div>
            </div>
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Button
                onClick={handleJoinRoom}
                disabled={!roomIdInput.trim() || isJoining || isCreating}
                variant="glass"
                size="lg"
                className="w-full h-14 text-lg font-semibold border-2 border-border hover:border-primary/50"
              >
                <Users className="w-5 h-5 mr-3" />
                {isJoining ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Joining...
                  </div>
                ) : (
                  'Join Room'
                )}
              </Button>
            </motion.div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center"
        >
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
            <span>Room IDs are 6 characters, case-insensitive</span>
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
