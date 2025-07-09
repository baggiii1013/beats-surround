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
  
  // Initialize client-side only values
  initialize: () => {
    if (typeof window !== 'undefined') {
      const roomId = generateRoomId();
      const userId = Math.random().toString(36).substring(2, 15);
      const username = `User_${Math.random().toString(36).substring(2, 5)}`;
      
      set({ roomId, userId, username });
    }
  },
}));
