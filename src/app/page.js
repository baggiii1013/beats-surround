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
  const isInitingSystem = useGlobalStore((state) => state.isInitingSystem);
  const audioSources = useGlobalStore((state) => state.audioSources);
  const initializeAudio = useGlobalStore((state) => state.initializeAudio);
  const roomId = useRoomStore((state) => state.roomId);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Initialize audio system only once when component mounts
  useEffect(() => {
    if (!hasInitialized && !isInitingSystem && audioSources.length === 0) {
      setHasInitialized(true);
      useGlobalStore.setState({ isInitingSystem: true });
      // Add a small delay to ensure state update is processed
      setTimeout(() => {
        initializeAudio().catch(() => {
          // If initialization fails, still mark as initialized to prevent retry loops
          console.warn('Audio initialization failed');
        });
      }, 50);
    }
  }, [hasInitialized, isInitingSystem, audioSources.length, initializeAudio]);
  
  // Force exit initialization if we have audio sources but are still initializing
  useEffect(() => {
    if (isInitingSystem && audioSources.length > 0) {
      useGlobalStore.setState({ isInitingSystem: false });
    }
  }, [isInitingSystem, audioSources.length]);
  
  if (isInitingSystem) {
    return (
      <>
        <AudioInitializer />
        <LoadingScreen />
      </>
    );
  }

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
      <AudioInitializer />
      <WebSocketManager />
      
      <ResponsiveLayout />
    </div>
  );
}
