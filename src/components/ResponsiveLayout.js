'use client';

import { useState } from 'react';
import { useDeviceDetect } from '../hooks/useDeviceDetect';
import AudioUploader from './AudioUploader';
import BottomNavigation from './BottomNavigation';
import MobileNavigation from './MobileNavigation';
import { MobilePlayerView, MobileQueueView, MobileRoomView, TabletPlayerView, TabletQueueView, TabletRoomView } from './MobileViews';
import Player from './Player';
import Queue from './Queue';
import RoomInfo from './RoomInfo';
import RoomJoiner from './RoomJoiner';
import SpatialAudioBackground from './SpatialAudioBackground';
import TabletNavigation from './TabletNavigation';
import TopBar from './TopBar';
import UserGrid from './UserGrid';

export default function ResponsiveLayout() {
  const [activeView, setActiveView] = useState('player');
  const { isMobile, isTablet } = useDeviceDetect();

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  const renderMobileView = (isTablet = false) => {
    const ViewComponent = isTablet ? 
      { player: TabletPlayerView, room: TabletRoomView, queue: TabletQueueView } :
      { player: MobilePlayerView, room: MobileRoomView, queue: MobileQueueView };
    
    const Component = ViewComponent[activeView] || ViewComponent.player;
    return <Component key={`${isTablet ? 'tablet' : 'mobile'}-${activeView}`} />;
  };

  return (
    <>
      {/* Mobile and Tablet Portrait Layout */}
      <div className="md:hidden h-screen flex flex-col bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--background-secondary))] to-[hsl(var(--background-tertiary))] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/6 left-1/6 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-1/6 right-1/6 w-48 h-48 bg-secondary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        </div>
        <TopBar />
        <div className="flex-1 relative overflow-hidden z-10">
          {renderMobileView(isTablet)}
        </div>
        <div className="relative z-20">
          <MobileNavigation 
            activeView={activeView} 
            onViewChange={handleViewChange}
            isTablet={isTablet}
          />
        </div>
      </div>

      {/* Tablet Landscape Layout */}
      <div className="hidden md:flex lg:hidden h-screen flex-row bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--background-secondary))] to-[hsl(var(--background-tertiary))] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/6 left-1/6 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-1/6 right-1/6 w-48 h-48 bg-secondary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        </div>
        <TabletNavigation activeView={activeView} onViewChange={handleViewChange} />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <div className="flex-1 relative overflow-hidden z-10">
            {renderMobileView(true)}
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block relative min-h-screen">
        <TopBar />
        <div className="flex h-[calc(100vh-5rem)] relative z-10">
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
          <div className="flex-1 flex flex-col glass">
            <Player />
          </div>
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
    </>
  );
}
