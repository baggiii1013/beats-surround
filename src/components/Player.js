'use client';

import {
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn, formatTime } from '../lib/utils';
import { useGlobalStore } from '../store/global';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

export default function Player() {
  const broadcastPlay = useGlobalStore((state) => state.broadcastPlay);
  const broadcastPause = useGlobalStore((state) => state.broadcastPause);
  const isPlaying = useGlobalStore((state) => state.isPlaying);
  const getCurrentTrackPosition = useGlobalStore((state) => state.getCurrentTrackPosition);
  const selectedAudioId = useGlobalStore((state) => state.selectedAudioId);
  const audioSources = useGlobalStore((state) => state.audioSources);
  const currentTime = useGlobalStore((state) => state.currentTime);
  const duration = useGlobalStore((state) => state.duration);
  const skipToNextTrack = useGlobalStore((state) => state.skipToNextTrack);
  const skipToPreviousTrack = useGlobalStore((state) => state.skipToPreviousTrack);
  const isShuffled = useGlobalStore((state) => state.isShuffled);
  const toggleShuffle = useGlobalStore((state) => state.toggleShuffle);
  const resumeAudioContext = useGlobalStore((state) => state.resumeAudioContext);

  // Local state for slider
  const [sliderPosition, setSliderPosition] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Find the selected audio source and its duration
  useEffect(() => {
    if (!selectedAudioId) return;

    const audioSource = audioSources.find(source => source.id === selectedAudioId);
    if (audioSource?.audioBuffer) {
      setTrackDuration(audioSource.audioBuffer.duration);
      setSliderPosition(0);
    }
  }, [selectedAudioId, audioSources]);

  // Sync with currentTime when it changes
  useEffect(() => {
    if (!isPlaying) {
      setSliderPosition(currentTime);
    }
  }, [currentTime, isPlaying]);

  // Update slider position during playback
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (!isDragging) {
        const currentPosition = getCurrentTrackPosition();
        setSliderPosition(currentPosition);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, getCurrentTrackPosition, isDragging]);

  // Handle slider change
  const handleSliderChange = useCallback((value) => {
    const position = value[0];
    setIsDragging(true);
    setSliderPosition(position);
  }, []);

  // Handle slider release - seek to that position
  const handleSliderCommit = useCallback((value) => {
    const newPosition = value[0];
    setIsDragging(false);
    
    if (isPlaying) {
      broadcastPlay(newPosition);
    } else {
      setSliderPosition(newPosition);
    }
  }, [broadcastPlay, isPlaying]);

  const handlePlay = useCallback(async () => {
    // Try to resume audio context first (for browser autoplay restrictions)
    await resumeAudioContext();
    
    if (isPlaying) {
      broadcastPause();
    } else {
      broadcastPlay(sliderPosition);
    }
  }, [isPlaying, broadcastPause, broadcastPlay, sliderPosition, resumeAudioContext]);

  const handleSkipBack = useCallback(() => {
    if (!isShuffled) {
      skipToPreviousTrack();
    }
  }, [skipToPreviousTrack, isShuffled]);

  const handleSkipForward = useCallback(() => {
    skipToNextTrack();
  }, [skipToNextTrack]);

  const handleShuffle = useCallback(() => {
    toggleShuffle();
  }, [toggleShuffle]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.code === 'Space' &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target.isContentEditable
        )
      ) {
        e.preventDefault();
        handlePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePlay]);

  const selectedSource = audioSources.find(source => source.id === selectedAudioId);

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[37rem]">
        {/* Current track info */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-white truncate">
            {selectedSource?.name || 'No track selected'}
          </h3>
          <p className="text-sm text-gray-400">
            {audioSources.length} {audioSources.length === 1 ? 'track' : 'tracks'} in queue
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 mb-4">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "text-gray-400 hover:text-white transition-colors",
              isShuffled && "text-blue-400"
            )}
            onClick={handleShuffle}
            disabled={audioSources.length <= 1}
          >
            <Shuffle className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white transition-colors"
            onClick={handleSkipBack}
            disabled={isShuffled || audioSources.length <= 1}
          >
            <SkipBack className="h-5 w-5" />
          </Button>

          <Button
            className="bg-white text-black rounded-full hover:scale-105 transition-transform"
            size="icon"
            onClick={handlePlay}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white transition-colors"
            onClick={handleSkipForward}
            disabled={audioSources.length <= 1}
          >
            <SkipForward className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Repeat className="h-4 w-4 text-blue-400" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 min-w-11">
            {formatTime(sliderPosition)}
          </span>
          <Slider
            value={[sliderPosition]}
            min={0}
            max={trackDuration}
            step={0.1}
            onValueChange={handleSliderChange}
            onValueCommit={handleSliderCommit}
            className="flex-1"
          />
          <span className="text-xs text-gray-400 min-w-11 text-right">
            {formatTime(trackDuration)}
          </span>
        </div>
      </div>
    </div>
  );
}
