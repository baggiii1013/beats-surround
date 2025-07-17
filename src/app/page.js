'use client';

import dynamic from 'next/dynamic';
import { Fragment, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import AudioInitializer from '../components/AudioInitializer';
import AudioUploader from '../components/AudioUploader';
import LoadingScreen from '../components/LoadingScreen';
import ResponsiveLayout from '../components/ResponsiveLayout';
import RoomSelector from '../components/RoomSelector';
import SpatialAudioBackground from '../components/SpatialAudioBackground';
import WebSocketManager from '../components/WebSocketManager';
import usePageRefreshReconnection from '../hooks/usePageRefreshReconnection';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';

// Dynamic import for client-side only component
const AudioCacheStatus = dynamic(() => import('../components/AudioCacheStatus'), {
  ssr: false,
  loading: () => null
});

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
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" />
      <SpatialAudioBackground />
      
      {/* AudioInitializer handles all initialization logic and UI */}
      <AudioInitializer />
      
      <WebSocketManager />
      
      <div className="fixed bottom-4 right-4 z-50">
        <AudioCacheStatus />
      </div>
      
      <ResponsiveLayout />
    </div>
  );
}
