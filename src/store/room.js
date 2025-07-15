import { create } from 'zustand';
import { generateRoomId } from '../lib/utils';

export const useRoomStore = create((set, get) => ({
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
    }
  },
}));
