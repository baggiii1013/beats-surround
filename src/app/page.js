'use client';

import { useEffect } from 'react';
import { Toaster } from 'sonner';
import AudioInitializer from '../components/AudioInitializer';
import LoadingScreen from '../components/LoadingScreen';
import ResponsiveLayout from '../components/ResponsiveLayout';
import RoomSelector from '../components/RoomSelector';
import WebSocketManager from '../components/WebSocketManager';
import usePageRefreshReconnection from '../hooks/usePageRefreshReconnection';
import { useRoomStore } from '../store/room';

export default function Home() {
  // Use the page refresh reconnection hook
  const { isPageRefresh, hasPersistedRoom } = usePageRefreshReconnection();
  
  // Only get the room state - let AudioInitializer handle audio initialization
  const roomId = useRoomStore((state) => state.roomId);
  const initialize = useRoomStore((state) => state.initialize);
  
  // Initialize room store
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Show room selector if no room is selected (and not in a page refresh scenario)
  if (!roomId && !isPageRefresh) {
    return (
      <>
        <Toaster position="top-right" />
        <RoomSelector />
      </>
    );
  }

  // Show loading if we're in the middle of a reconnection attempt
  if (isPageRefresh && hasPersistedRoom && !roomId) {
    return (
      <>
        <Toaster position="top-right" />
        <LoadingScreen message="Reconnecting to room..." />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--background-secondary))] to-[hsl(var(--background-tertiary))] text-white relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-secondary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-accent/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <Toaster 
        position="top-right" 
        theme="dark"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
          },
        }}
      />
      
      {/* AudioInitializer handles all initialization logic and UI */}
      <AudioInitializer />
      
      <WebSocketManager />
      
      <div className="relative z-10">
        <ResponsiveLayout />
      </div>
    </div>
  );
}
