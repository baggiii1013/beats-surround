'use client';

import { Fragment, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import AudioInitializer from '../components/AudioInitializer';
import AudioUploader from '../components/AudioUploader';
import LoadingScreen from '../components/LoadingScreen';
import ResponsiveLayout from '../components/ResponsiveLayout';
import RoomSelector from '../components/RoomSelector';
import SpatialAudioBackground from '../components/SpatialAudioBackground';
import WebSocketManager from '../components/WebSocketManager';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';

export default function Home() {
  // Only get the room state - let AudioInitializer handle audio initialization
  const roomId = useRoomStore((state) => state.roomId);
  const initialize = useRoomStore((state) => state.initialize);
  
  // Initialize room store
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Show room selector if no room is selected
  if (!roomId) {
    return (
      <>
        <Toaster position="top-right" />
        <RoomSelector />
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
      <ResponsiveLayout />
    </div>
  );
}
