'use client';

import {
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn, formatTime } from '../lib/utils';
import { useGlobalStore } from '../store/global';
import { Button } from './ui/button';
import ElasticSlider from './ui/ElasticSlider';

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
  const audioPlayer = useGlobalStore((state) => state.audioPlayer);

  // Local state for sliders
  const [sliderPosition, setSliderPosition] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(50);

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
  
  // Check if audio context is suspended
  const isAudioSuspended = audioPlayer?.suspended || selectedSource?.requiresUserInteraction;

  const handleEnableAudio = async () => {
    await resumeAudioContext();
  };

  // Volume control functions
  const updateVolume = useCallback((newVolume) => {
    if (audioPlayer?.gainNode) {
      const normalizedVolume = newVolume / 100;
      audioPlayer.gainNode.gain.value = normalizedVolume;
    }
  }, [audioPlayer]);

  const handleVolumeChange = useCallback((newVolume) => {
    setVolume(newVolume);
    updateVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  }, [updateVolume, isMuted]);

  const handleVolumeCommit = useCallback((finalVolume) => {
    // Optional: Add any logic for when volume adjustment is complete
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(previousVolume);
      updateVolume(previousVolume);
    } else {
      setIsMuted(true);
      setPreviousVolume(volume);
      setVolume(0);
      updateVolume(0);
    }
  }, [isMuted, volume, previousVolume, updateVolume]);

  // Initialize volume when audio player is available
  useEffect(() => {
    if (audioPlayer?.gainNode) {
      updateVolume(volume);
    }
  }, [audioPlayer, updateVolume, volume]);

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

        {/* Autoplay restriction warning */}
        {isAudioSuspended && (
          <div className="bg-orange-900/50 border border-orange-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-400 text-sm font-medium">Audio Blocked</p>
                <p className="text-orange-300 text-xs">Your browser blocked audio autoplay</p>
              </div>
              <button
                onClick={handleEnableAudio}
                className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs transition-colors"
              >
                Enable Audio
              </button>
            </div>
          </div>
        )}

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
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-gray-400 min-w-11">
            {formatTime(sliderPosition)}
          </span>
          <ElasticSlider
            value={sliderPosition}
            startingValue={0}
            maxValue={trackDuration}
            onChange={(value) => {
              setIsDragging(true);
              setSliderPosition(value);
            }}
            onCommit={(value) => {
              setIsDragging(false);
              if (isPlaying) {
                broadcastPlay(value);
              } else {
                setSliderPosition(value);
              }
            }}
            leftIcon={<div className="w-2 h-2 bg-gray-400 rounded-full" />}
            rightIcon={<div className="w-2 h-2 bg-gray-400 rounded-full" />}
            showValue={false}
            className="flex-1"
          />
          <span className="text-xs text-gray-400 min-w-11 text-right">
            {formatTime(trackDuration)}
          </span>
        </div>

        {/* Volume control */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white transition-colors"
            onClick={toggleMute}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <ElasticSlider
            value={volume}
            startingValue={0}
            maxValue={100}
            onChange={handleVolumeChange}
            onCommit={handleVolumeCommit}
            leftIcon={<VolumeX className="h-3 w-3 text-gray-400" />}
            rightIcon={<Volume2 className="h-3 w-3 text-gray-400" />}
            showValue={true}
            formatValue={(val) => `${Math.round(val)}%`}
            className="w-48"
          />
        </div>
      </div>
    </div>
  );
}
