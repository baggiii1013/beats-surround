import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearExpiredCache } from '../lib/simpleAudioCache';
import { generateRoomId } from '../lib/utils';

export const useRoomStore = create(
  persist(
    (set, get) => ({
      roomId: null,
      userId: null,
      username: null,
      isConnected: false,
      
      setRoomId: (roomId) => set({ roomId }),
      setUserId: (userId) => set({ userId }),
      setUsername: (username) => set({ username }),
      setIsConnected: (isConnected) => set({ isConnected }),
      
      generateNewRoomId: () => {
        const newRoomId = generateRoomId();
        set({ roomId: newRoomId });
        return newRoomId;
      },
      
      // Initialize client-side only values (without auto room creation)
      initialize: () => {
        if (typeof window !== 'undefined') {
          const state = get();
          
          // Only set userId and username if they don't exist
          if (!state.userId) {
            const userId = Math.random().toString(36).substring(2, 15);
            set({ userId });
          }
          
          if (!state.username) {
            const username = `User_${Math.random().toString(36).substring(2, 5)}`;
            set({ username });
          }

          // Clean up expired cache entries on initialization
          clearExpiredCache().catch(() => {
            // Silently handle cache cleanup errors
          });
        }
      },

      // Clear persisted data (for intentional room leaving)
      clearPersistedData: () => {
        set({ 
          roomId: null,
          userId: null, 
          username: null,
          isConnected: false 
        });
      },

      // Reset but preserve user info for reconnection
      resetForReconnection: () => {
        const state = get();
        set({ 
          isConnected: false,
          // Keep roomId, userId, username for reconnection
        });
      },
    }),
    {
      name: "beats-surround-room", // localStorage key
      partialize: (state) => ({
        roomId: state.roomId,
        userId: state.userId,
        username: state.username,
      }),
    }
  )
);
