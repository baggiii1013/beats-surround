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
import SpatialAudioBackground from './SpatialAudioBackground';
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
    // Mobile and Tablet Layout with Modern Dock Navigation
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--background-secondary))] to-[hsl(var(--background-tertiary))] relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/6 left-1/6 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-1/6 right-1/6 w-48 h-48 bg-secondary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        </div>
        
        {/* Top Navigation */}
        <TopBar />
        
        {/* Main Content Area */}
        <div className="flex-1 relative overflow-hidden z-10">
          {renderMobileView()}
        </div>
        
        {/* Enhanced Dock Navigation */}
        <div className="relative z-20">
          <MobileNavigation 
            activeView={activeView} 
            onViewChange={handleViewChange}
            isTablet={isTablet}
          />
        </div>
      </div>
    );
  }

  // Desktop Layout (Enhanced)
  return (
    <div className="relative min-h-screen">
      {/* Top Navigation */}
      <TopBar />
      
      {/* Main Content */}
      <div className="flex h-[calc(100vh-5rem)] relative z-10">
        {/* Left Sidebar - Queue */}
        <div className="w-1/3 flex flex-col">
          <div className="glass-strong border-r border-border/50 p-6 border-b border-border/50">
            <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-white to-accent bg-clip-text text-transparent">
              Music Queue
            </h2>
            <AudioUploader className="mb-4" />
          </div>
          <div className="flex-1 glass border-r border-border/50 overflow-y-auto p-6">
            <Queue />
          </div>
        </div>
        
        {/* Center - Player */}
        <div className="flex-1 flex flex-col glass">
          <Player />
        </div>
        
        {/* Right Sidebar - Room Info, Spatial Audio & Users */}
        <div className="w-1/3 flex flex-col">
          <div className="flex-1 glass border-l border-border/50 overflow-y-auto">
            <div className="p-6 space-y-6">
              <RoomInfo />
              <RoomJoiner />
              <SpatialAudioBackground />
              <div className="glass rounded-2xl border border-border">
                <div className="p-4 border-b border-border/50">
                  <h3 className="text-lg font-semibold text-white">Connected Users</h3>
                </div>
                <UserGrid />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
