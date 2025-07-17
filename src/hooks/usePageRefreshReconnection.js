'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';

/**
 * Hook to handle automatic reconnection after page refresh
 * Based on BeatSync's approach of persisting room state and auto-reconnecting
 */
export const usePageRefreshReconnection = () => {
  const roomId = useRoomStore((state) => state.roomId);
  const username = useRoomStore((state) => state.username);
  const userId = useRoomStore((state) => state.userId);
  const setRoomId = useRoomStore((state) => state.setRoomId);
  const initialize = useRoomStore((state) => state.initialize);
  const resetForReconnection = useRoomStore((state) => state.resetForReconnection);
  const clearPersistedData = useRoomStore((state) => state.clearPersistedData);
  
  const socket = useGlobalStore((state) => state.socket);
  const resetStore = useGlobalStore((state) => state.resetStore);
  
  const hasAttemptedReconnection = useRef(false);
  const isUnloading = useRef(false);

  // Detect if this is a page refresh/reload
  const isPageRefresh = () => {
    // Check if we have persisted room data but no active connection
    return roomId && username && !socket;
  };

  // Check if room still exists on server
  const checkRoomExists = async (roomId) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/rooms/${roomId}`);
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  // Handle beforeunload to track intentional navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      isUnloading.current = true;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Auto-reconnection logic on mount
  useEffect(() => {
    const attemptReconnection = async () => {
      if (hasAttemptedReconnection.current) return;
      hasAttemptedReconnection.current = true;

      // Only attempt reconnection if we detect a page refresh scenario
      if (!isPageRefresh()) {
        return;
      }

      try {
        // Check if the room still exists on the server
        const roomExists = await checkRoomExists(roomId);
        
        if (roomExists) {
          toast.success(`Reconnecting to room ${roomId}...`);
          
          // Reset connection state but keep room info
          resetForReconnection();
          
          // Reinitialize user session
          initialize();
          
          // The WebSocketManager will handle the actual reconnection
          // since roomId and username are now available
        } else {
          toast.error('Room no longer exists. Redirecting to home...');
          
          // Clear persisted data and redirect
          clearPersistedData();
          resetStore();
          
          // Redirect to home after a delay
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
      } catch (error) {
        toast.error('Failed to reconnect. Please join a room manually.');
        
        // Clear persisted data on reconnection failure
        clearPersistedData();
        resetStore();
      }
    };

    // Small delay to ensure stores are hydrated
    const timeoutId = setTimeout(attemptReconnection, 100);
    
    return () => clearTimeout(timeoutId);
  }, []); // Empty deps - only run on mount

  // Return reconnection utilities
  return {
    isPageRefresh: isPageRefresh(),
    hasPersistedRoom: Boolean(roomId && username),
    clearPersistedRoom: () => {
      clearPersistedData();
      resetStore();
    }
  };
};

export default usePageRefreshReconnection;
