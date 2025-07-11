'use client';

import { useEffect, useState } from 'react';
import AudioUploader from './AudioUploader';
import BottomNavigation from './BottomNavigation';
import Player from './Player';
import Queue from './Queue';
import RoomJoiner from './RoomJoiner';
import TopBar from './TopBar';
import UserGrid from './UserGrid';

export default function ResponsiveLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Add viewport meta tag for mobile devices
    if (typeof window !== 'undefined') {
      let viewport = document.querySelector('meta[name=viewport]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        document.head.appendChild(viewport);
      }
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    }
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    // Mobile Layout
    return (
      <>
        {/* Top Navigation */}
        <TopBar />
        
        {/* Main Content - Just the Player */}
        <div className="h-[calc(100vh-8rem)] overflow-y-auto pb-4">
          <Player />
        </div>
        
        {/* Bottom Navigation */}
        <BottomNavigation />
      </>
    );
  }

  // Desktop Layout (Original)
  return (
    <>
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
          <Player />
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
    </>
  );
}
