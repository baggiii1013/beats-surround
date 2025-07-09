'use client';

import { motion } from 'framer-motion';
import { Loader2, Volume2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <Volume2 className="w-8 h-8 text-white" />
        </motion.div>
        
        <h2 className="text-xl font-bold text-white mb-2">BeatsSurround</h2>
        <p className="text-gray-400 text-sm mb-4">Initializing audio system...</p>
        
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          <span className="text-blue-400 text-sm">Loading</span>
        </div>
      </motion.div>
    </div>
  );
}
