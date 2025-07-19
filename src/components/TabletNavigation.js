'use client';

import { motion } from 'framer-motion';
import { List, Music, Users } from 'lucide-react';

export default function TabletNavigation({ activeView, onViewChange }) {
  const navItems = [
    {
      icon: <List size={28} strokeWidth={2.5} />,
      label: 'Queue',
      view: 'queue',
    },
    {
      icon: <Music size={28} strokeWidth={2.5} />,
      label: 'Player',
      view: 'player',
    },
    {
      icon: <Users size={28} strokeWidth={2.5} />,
      label: 'Room',
      view: 'room',
    },
  ];

  return (
    <motion.div 
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        delay: 0.2 
      }}
      className="h-full w-24 bg-gradient-to-b from-transparent via-black/10 to-transparent flex flex-col items-center justify-center space-y-8 p-4 border-r border-border/50"
    >
      {navItems.map((item) => (
        <button
          key={item.view}
          onClick={() => onViewChange(item.view)}
          className={`
            w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all duration-300
            ${activeView === item.view 
              ? 'bg-primary text-primary-foreground shadow-lg scale-110' 
              : 'bg-background/50 text-foreground/80 hover:bg-accent hover:text-accent-foreground'
            }
          `}
        >
          {item.icon}
          <span className="text-xs mt-1">{item.label}</span>
        </button>
      ))}
    </motion.div>
  );
}
