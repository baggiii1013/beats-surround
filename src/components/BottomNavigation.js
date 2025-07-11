'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { List, Users } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';
import AudioUploader from './AudioUploader';
import Queue from './Queue';
import RoomJoiner from './RoomJoiner';
import { Badge } from './ui/badge';
import UserGrid from './UserGrid';

export default function BottomNavigation() {
  const [activeTab, setActiveTab] = useState(null);
  const roomId = useRoomStore((state) => state.roomId);
  const connectedClients = useGlobalStore((state) => state.connectedClients);
  const audioSources = useGlobalStore((state) => state.audioSources);

  const tabs = [
    {
      id: 'queue',
      icon: List,
      label: 'Queue',
      badge: audioSources.length > 0 ? audioSources.length : null
    },
    {
      id: 'spatial',
      icon: Users,
      label: 'Spatial',
      badge: connectedClients.length > 0 ? connectedClients.length : null
    }
  ];

  return (
    <>
      {/* Bottom Sheet Content */}
      <AnimatePresence>
        {activeTab && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-20 top-20 bg-black/95 backdrop-blur-xl border-t border-gray-700 z-40 flex flex-col"
          >
            {/* Sheet Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">
                {activeTab === 'queue' ? 'Music Queue' : 'Spatial Audio & Room'}
              </h2>
              <button
                onClick={() => setActiveTab(null)}
                className="text-gray-400 hover:text-white p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Sheet Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'queue' && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-gray-700">
                    <AudioUploader className="w-full" />
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <Queue />
                  </div>
                </div>
              )}
              
              {activeTab === 'spatial' && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-gray-700">
                    <RoomJoiner />
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <UserGrid />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-gray-700 z-50 bottom-nav">
        <div className="grid grid-cols-2 h-20">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(isActive ? null : tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center space-y-1 transition-all relative",
                  isActive 
                    ? "text-white bg-white/10" 
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <div className="relative">
                  <Icon className="w-6 h-6" />
                  {tab.badge && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-2 -right-2 text-xs min-w-[1.25rem] h-5 flex items-center justify-center bg-blue-600 text-white"
                    >
                      {tab.badge}
                    </Badge>
                  )}
                </div>
                <span className="text-xs font-medium">{tab.label}</span>
                
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute top-0 left-1/2 w-12 h-1 bg-white rounded-b-full transform -translate-x-1/2"
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
