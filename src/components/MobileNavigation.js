'use client';

import { motion } from 'framer-motion';
import { List, Music, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import Dock from './ui/Dock';

export default function MobileNavigation({ activeView, onViewChange, isTablet = false }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleViewChange = (view) => {
    // Haptic feedback for mobile devices
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    onViewChange(view);
  };

  const dockItems = [
    {
      icon: <List size={isTablet ? 28 : 24} strokeWidth={2.5} />,
      label: 'Queue',
      onClick: () => handleViewChange('queue'),
      className: activeView === 'queue' 
        ? 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-900/40 to-blue-600/20 shadow-lg shadow-blue-500/25' 
        : 'hover:bg-neutral-800/50 transition-colors'
    },
    {
      icon: <Music size={isTablet ? 28 : 24} strokeWidth={2.5} />,
      label: 'Player',
      onClick: () => handleViewChange('player'),
      className: activeView === 'player' 
        ? 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-900/40 to-blue-600/20 shadow-lg shadow-blue-500/25' 
        : 'hover:bg-neutral-800/50 transition-colors'
    },
    {
      icon: <Users size={isTablet ? 28 : 24} strokeWidth={2.5} />,
      label: 'Room',
      onClick: () => handleViewChange('room'),
      className: activeView === 'room' 
        ? 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-900/40 to-blue-600/20 shadow-lg shadow-blue-500/25' 
        : 'hover:bg-neutral-800/50 transition-colors'
    },
  ];

  if (!mounted) return null;

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        delay: 0.2 
      }}
      className="fixed bottom-0 left-0 right-0 z-50 pb-safe pointer-events-none"
    >
      <div className="pointer-events-auto">
        <Dock
          items={dockItems}
          magnification={isTablet ? 76 : 64}
          distance={isTablet ? 180 : 160}
          panelHeight={isTablet ? 76 : 68}
          baseItemSize={isTablet ? 56 : 48}
          spring={{ mass: 0.08, stiffness: 250, damping: 18 }}
          className="bg-black/60 backdrop-blur-xl shadow-2xl"
        />
      </div>
    </motion.div>
  );
}
