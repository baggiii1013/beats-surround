'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';

export default function LeaveRoomButton({ className = '' }) {
  const router = useRouter();
  const roomId = useRoomStore((state) => state.roomId);
  const clearPersistedData = useRoomStore((state) => state.clearPersistedData);
  const resetStore = useGlobalStore((state) => state.resetStore);
  const socket = useGlobalStore((state) => state.socket);

  const handleLeaveRoom = async () => {
    // Close WebSocket connection
    if (socket) {
      socket.close(1000); // Normal closure
    }

    // Clear all persisted data
    clearPersistedData();
    
    // Reset store and clear cache
    await resetStore();

    toast.success('Left room successfully');
    
    // Redirect to home
    router.push('/');
  };

  if (!roomId) return null;

  return (
    <button
      onClick={handleLeaveRoom}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 
        text-sm text-red-400 hover:text-red-300 
        border border-red-400/30 hover:border-red-400/50 
        rounded-md transition-colors duration-200
        ${className}
      `}
      title="Leave Room"
    >
      <LogOut className="w-4 h-4" />
      <span className="hidden sm:inline">Leave Room</span>
    </button>
  );
}
