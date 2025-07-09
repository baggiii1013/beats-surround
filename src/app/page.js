'use client';

import { Toaster } from 'sonner';
import AudioInitializer from '../components/AudioInitializer';
import AudioUploader from '../components/AudioUploader';
import LoadingScreen from '../components/LoadingScreen';
import Player from '../components/Player';
import Queue from '../components/Queue';
import SpatialAudioBackground from '../components/SpatialAudioBackground';
import TopBar from '../components/TopBar';
import UserGrid from '../components/UserGrid';
import { useGlobalStore } from '../store/global';

export default function Home() {
  const isInitingSystem = useGlobalStore((state) => state.isInitingSystem);
  
  if (isInitingSystem) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" />
      <SpatialAudioBackground />
      <AudioInitializer />
      
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
        
        {/* Right Sidebar - Spatial Audio */}
        <div className="w-1/3 border-l border-gray-700">
          <UserGrid />
        </div>
      </div>
    </div>
  );
}
