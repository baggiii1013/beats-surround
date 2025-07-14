'use client';

import { useEffect, useState } from 'react';
import AudioUploader from './AudioUploader';
import BottomNavigation from './BottomNavigation';
import MobileNavigation from './MobileNavigation';
import { MobilePlayerView, MobileQueueView, MobileRoomView, TabletPlayerView, TabletQueueView, TabletRoomView } from './MobileViews';
import Player from './Player';
import Queue from './Queue';
import RoomInfo from './RoomInfo';
import RoomJoiner from './RoomJoiner';
import TopBar from './TopBar';
import UserGrid from './UserGrid';

export default function ResponsiveLayout() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [activeView, setActiveView] = useState('player');

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768); // md breakpoint
      setIsTablet(width >= 768 && width < 1024); // between md and lg
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
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
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  const renderMobileView = () => {
    const ViewComponent = isTablet ? 
      { player: TabletPlayerView, room: TabletRoomView, queue: TabletQueueView } :
      { player: MobilePlayerView, room: MobileRoomView, queue: MobileQueueView };
    
    const Component = ViewComponent[activeView] || ViewComponent.player;
    return <Component key={`${isTablet ? 'tablet' : 'mobile'}-${activeView}`} />;
  };

  if (isMobile || isTablet) {
    // Mobile and Tablet Layout with Dock Navigation
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-black via-gray-900 to-black">
        {/* Top Navigation */}
        <TopBar />
        
        {/* Main Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {renderMobileView()}
        </div>
        
        {/* Dock Navigation */}
        <MobileNavigation 
          activeView={activeView} 
          onViewChange={handleViewChange}
          isTablet={isTablet}
        />
      </div>
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
        
        {/* Right Sidebar - Room Info, Spatial Audio & Users */}
        <div className="w-1/3 border-l border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <RoomInfo className="mb-4" />
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
