'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal, Pause, Play, UploadCloud } from 'lucide-react';
import { cn } from '../lib/utils';
import { useGlobalStore } from '../store/global';
import { Button } from './ui/button';

export default function Queue({ className, ...rest }) {
  const audioSources = useGlobalStore((state) => state.audioSources);
  const selectedAudioId = useGlobalStore((state) => state.selectedAudioId);
  const setSelectedAudioId = useGlobalStore((state) => state.setSelectedAudioId);
  const isInitingSystem = useGlobalStore((state) => state.isInitingSystem);
  const broadcastPlay = useGlobalStore((state) => state.broadcastPlay);
  const isPlaying = useGlobalStore((state) => state.isPlaying);

  const handleTrackClick = (sourceId) => {
    const wasPlaying = setSelectedAudioId(sourceId);
    if (wasPlaying) {
      setTimeout(() => {
        broadcastPlay(0);
      }, 100);
    }
  };

  return (
    <div className={cn("", className)} {...rest}>
      <div className="space-y-1">
        {audioSources.length > 0 ? (
          <AnimatePresence initial={true}>
            {audioSources.map((source, index) => {
              const isSelected = source.id === selectedAudioId;
              const isPlayingThis = isSelected && isPlaying;

              return (
                <motion.div
                  key={source.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.05 * index,
                    ease: "easeOut",
                  }}
                  className={cn(
                    "flex items-center pl-2 pr-4 py-3 rounded-md group transition-colors select-none",
                    isSelected
                      ? "bg-white/10 border border-white/20"
                      : "hover:bg-white/5 cursor-pointer"
                  )}
                  onClick={() => handleTrackClick(source.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center relative">
                      {isPlayingThis ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <div className="w-1 bg-white rounded-full animate-pulse" style={{ height: '60%' }} />
                          <div className="w-1 bg-white rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.1s' }} />
                          <div className="w-1 bg-white rounded-full animate-pulse" style={{ height: '80%', animationDelay: '0.2s' }} />
                        </div>
                      ) : (
                        <Play className="w-4 h-4 text-white" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate text-sm">
                        {source.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {source.audioBuffer ? `${Math.floor(source.audioBuffer.duration / 60)}:${Math.floor(source.audioBuffer.duration % 60).toString().padStart(2, '0')}` : '--:--'}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle more options
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <UploadCloud className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No audio files loaded</p>
            <p className="text-xs">Upload audio files to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
