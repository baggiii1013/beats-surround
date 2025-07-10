'use client';

import { Fragment, useEffect } from 'react';
import { Toaster } from 'sonner';
import AudioInitializer from '../components/AudioInitializer';
import AudioUploader from '../components/AudioUploader';
import LoadingScreen from '../components/LoadingScreen';
import Player from '../components/Player';
import Queue from '../components/Queue';
import RoomJoiner from '../components/RoomJoiner';
import SpatialAudioBackground from '../components/SpatialAudioBackground';
import TopBar from '../components/TopBar';
import UserGrid from '../components/UserGrid';
import WebSocketManager from '../components/WebSocketManager';
import { useGlobalStore } from '../store/global';

export default function Home() {
  const isInitingSystem = useGlobalStore((state) => state.isInitingSystem);
  const audioSources = useGlobalStore((state) => state.audioSources);
  const initializeAudio = useGlobalStore((state) => state.initializeAudio);
  
  // If no audio sources and not initializing, start initialization
  useEffect(() => {
    if (!isInitingSystem && audioSources.length === 0) {
      useGlobalStore.setState({ isInitingSystem: true });
      // Add a small delay to ensure state update is processed
      setTimeout(() => {
        initializeAudio();
      }, 50);
    }
  }, [isInitingSystem, audioSources.length, initializeAudio]);
  
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

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" />
      <SpatialAudioBackground />
      <AudioInitializer />
      <WebSocketManager />
      
      {/* Top Navigation */}
      <TopBar />
      
      {/* Main Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Queue */}
        <div className="w-1/3 border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Music Queue</h2>
            <AudioUploader className="mb-4" />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <Queue />
          </div>
        </div>
        
        {/* Center - Player */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-2xl">
              <Player />
            </div>
          </div>
        </div>
        
        {/* Right Sidebar - Spatial Audio & Room */}
        <div className="w-1/3 border-l border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <RoomJoiner />
          </div>
          <div className="flex-1">
            <UserGrid />
          </div>
        </div>
      </div>
    </div>
  );
}
