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
    <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
      {/* Mobile Layout (Portrait) */}
      <div className="md:hidden w-full max-w-sm">
        <div className="w-full flex justify-center px-2 py-4">
          <div className="w-full max-w-sm mx-auto">
            {/* Mobile Cover Art */}
            <div className="flex justify-center mb-6 backdrop-brightness-50">
              <div className="relative">
                <div className="w-64 h-64 bg-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                  {selectedSource?.coverArt ? (
                    <img
                      src={selectedSource.coverArt}
                      alt={`${selectedSource.name} cover`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-600/20 via-blue-600/20 to-cyan-600/20 flex items-center justify-center">
                      <div className="text-5xl text-gray-400 opacity-50">♪</div>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 rounded-2xl -z-10 blur-xl scale-105" />
              </div>
            </div>

            {/* Mobile Track Information */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-white mb-2 leading-tight">
                {selectedSource?.name || 'No track selected'}
              </h1>
              <p className="text-base text-gray-400 mb-1">
                {selectedSource?.artist || 'Unknown Artist'}
              </p>
              {selectedSource?.album && (
                <p className="text-sm text-gray-500">
                  {selectedSource.album}
                  {selectedSource.year && ` • ${selectedSource.year}`}
                </p>
              )}
            </div>

            {/* Mobile Controls */}
            <div className="flex items-center justify-center gap-6 mb-6">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-gray-400 hover:text-white transition-all hover:scale-110",
                  isShuffled && "text-blue-400"
                )}
                onClick={handleShuffle}
                disabled={audioSources.length <= 1}
              >
                <Shuffle className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white transition-all hover:scale-110"
                onClick={handleSkipBack}
                disabled={isShuffled || audioSources.length <= 1}
              >
                <SkipBack className="h-6 w-6" />
              </Button>

              <Button
                className="bg-white text-black rounded-full hover:scale-110 transition-all shadow-lg w-14 h-14"
                onClick={handlePlay}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-1" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white transition-all hover:scale-110"
                onClick={handleSkipForward}
                disabled={audioSources.length <= 1}
              >
                <SkipForward className="h-6 w-6" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white transition-all hover:scale-110"
              >
                <Repeat className="h-5 w-5 text-blue-400" />
              </Button>
            </div>

            {/* Mobile Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400 font-mono">
                  {formatTime(sliderPosition)}
                </span>
                <div className="flex flex-col items-center justify-center gap-4 flex-1">
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
                    leftIcon={<div className="w-1 h-1 bg-gray-400 rounded-full" />}
                    rightIcon={<div className="w-1 h-1 bg-gray-400 rounded-full" />}
                    showValue={false}
                    className="w-full"
                  />
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  {formatTime(trackDuration)}
                </span>
              </div>
            </div>

            {/* Mobile Volume Control */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white transition-all hover:scale-110"
                onClick={toggleMute}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <div className="flex flex-col items-center justify-center gap-4 w-48">
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
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tablet Layout (Portrait - md and up) */}
      <div className="hidden md:flex lg:hidden w-full max-w-2xl h-full flex-col">
        {/* Top Section - Cover Art */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="relative">
            <div className="w-80 h-80 bg-gray-800 rounded-3xl overflow-hidden shadow-2xl">
              {selectedSource?.coverArt ? (
                <img
                  src={selectedSource.coverArt}
                  alt={`${selectedSource.name} cover`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-600/20 via-blue-600/20 to-cyan-600/20 flex items-center justify-center">
                  <div className="text-8xl text-gray-400 opacity-50">♪</div>
                </div>
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 rounded-3xl -z-10 blur-2xl scale-110" />
          </div>
        </div>

        {/* Bottom Section - All Controls */}
        <div className="flex-shrink-0 p-6 space-y-6">
          {/* Track Information */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white leading-tight">
              {selectedSource?.name || 'No track selected'}
            </h1>
            <p className="text-xl text-gray-400">
              {selectedSource?.artist || 'Unknown Artist'}
            </p>
            {selectedSource?.album && (
              <p className="text-base text-gray-500">
                {selectedSource.album}
                {selectedSource.year && ` • ${selectedSource.year}`}
              </p>
            )}
            {selectedSource?.genre && (
              <p className="text-sm text-gray-600 uppercase tracking-wide">
                {selectedSource.genre}
              </p>
            )}
          </div>

          {/* Autoplay Warning */}
          {isAudioSuspended && (
            <div className="bg-orange-900/30 border border-orange-500/30 rounded-xl p-4 backdrop-blur-sm">
              <div className="text-center">
                <p className="text-orange-400 text-sm font-semibold mb-1">Audio Blocked</p>
                <p className="text-orange-300 text-xs mb-3">Your browser blocked audio autoplay</p>
                <button
                  onClick={handleEnableAudio}
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-full text-sm font-medium transition-all hover:scale-105"
                >
                  Enable Audio
                </button>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400 font-mono w-12">
                {formatTime(sliderPosition)}
              </span>
              <div className="flex-1">
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
                  leftIcon={<div className="w-1 h-1 bg-gray-400 rounded-full" />}
                  rightIcon={<div className="w-1 h-1 bg-gray-400 rounded-full" />}
                  showValue={false}
                  className="w-full"
                />
              </div>
              <span className="text-sm text-gray-400 font-mono w-12 text-right">
                {formatTime(trackDuration)}
              </span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-center gap-8">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "text-gray-400 hover:text-white transition-all hover:scale-110 w-12 h-12",
                isShuffled && "text-blue-400"
              )}
              onClick={handleShuffle}
              disabled={audioSources.length <= 1}
            >
              <Shuffle className="h-7 w-7" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white transition-all hover:scale-110 w-12 h-12"
              onClick={handleSkipBack}
              disabled={isShuffled || audioSources.length <= 1}
            >
              <SkipBack className="h-8 w-8" />
            </Button>

            <Button
              className="bg-white text-black rounded-full hover:scale-110 transition-all shadow-lg w-20 h-20"
              onClick={handlePlay}
            >
              {isPlaying ? (
                <Pause className="h-10 w-10" />
              ) : (
                <Play className="h-10 w-10 ml-1" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white transition-all hover:scale-110 w-12 h-12"
              onClick={handleSkipForward}
              disabled={audioSources.length <= 1}
            >
              <SkipForward className="h-8 w-8" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white transition-all hover:scale-110 w-12 h-12"
            >
              <Repeat className="h-7 w-7 text-blue-400" />
            </Button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white transition-all hover:scale-110"
              onClick={toggleMute}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-6 w-6" />
              ) : (
                <Volume2 className="h-6 w-6" />
              )}
            </Button>
            <div className="flex-1 max-w-sm">
              <ElasticSlider
                value={volume}
                startingValue={0}
                maxValue={100}
                onChange={handleVolumeChange}
                onCommit={handleVolumeCommit}
                leftIcon={<VolumeX className="h-4 w-4 text-gray-400" />}
                rightIcon={<Volume2 className="h-4 w-4 text-gray-400" />}
                showValue={true}
                formatValue={(val) => `${Math.round(val)}%`}
                className="w-full"
              />
            </div>
          </div>

          {/* Queue Info */}
          <div className="text-center text-gray-500">
            <p className="text-base">
              {audioSources.length} {audioSources.length === 1 ? 'track' : 'tracks'} in queue
            </p>
          </div>
        </div>
      </div>

      {/* Desktop Layout (lg and up) - Original layout */}
      <div className="hidden lg:block w-full max-w-2xl">
        <div className="w-full flex justify-center px-4 py-6">
          <div className="w-full max-w-sm mx-auto">
            {/* Desktop Cover Art */}
            <div className="flex justify-center mb-8 backdrop-brightness-50">
              <div className="relative">
                <div className="w-72 h-72 bg-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                  {selectedSource?.coverArt ? (
                    <img
                      src={selectedSource.coverArt}
                      alt={`${selectedSource.name} cover`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-600/20 via-blue-600/20 to-cyan-600/20 flex items-center justify-center">
                      <div className="text-6xl text-gray-400 opacity-50">♪</div>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 rounded-2xl -z-10 blur-xl scale-105" />
              </div>
            </div>

            {/* Desktop Track Information */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2 leading-tight">
                {selectedSource?.name || 'No track selected'}
              </h1>
              <p className="text-lg text-gray-400 mb-1">
                {selectedSource?.artist || 'Unknown Artist'}
              </p>
              {selectedSource?.album && (
                <p className="text-sm text-gray-500">
                  {selectedSource.album}
                  {selectedSource.year && ` • ${selectedSource.year}`}
                </p>
              )}
              {selectedSource?.genre && (
                <p className="text-xs text-gray-600 mt-1 uppercase tracking-wide">
                  {selectedSource.genre}
                </p>
              )}
            </div>

            {/* Desktop Autoplay warning */}
            {isAudioSuspended && (
              <div className="bg-orange-900/30 border border-orange-500/30 rounded-xl p-4 mb-6 backdrop-blur-sm">
                <div className="text-center">
                  <p className="text-orange-400 text-sm font-semibold mb-1">Audio Blocked</p>
                  <p className="text-orange-300 text-xs mb-3">Your browser blocked audio autoplay</p>
                  <button
                    onClick={handleEnableAudio}
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-full text-sm font-medium transition-all hover:scale-105"
                  >
                    Enable Audio
                  </button>
                </div>
              </div>
            )}

            {/* Desktop Main Controls */}
            <div className="flex items-center justify-center gap-8 mb-8">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-gray-400 hover:text-white transition-all hover:scale-110",
                  isShuffled && "text-blue-400"
                )}
                onClick={handleShuffle}
                disabled={audioSources.length <= 1}
              >
                <Shuffle className="h-6 w-6" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white transition-all hover:scale-110"
                onClick={handleSkipBack}
                disabled={isShuffled || audioSources.length <= 1}
              >
                <SkipBack className="h-7 w-7" />
              </Button>

              <Button
                className="bg-white text-black rounded-full hover:scale-110 transition-all shadow-lg w-16 h-16"
                onClick={handlePlay}
              >
                {isPlaying ? (
                  <Pause className="h-7 w-7" />
                ) : (
                  <Play className="h-7 w-7 ml-1" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white transition-all hover:scale-110"
                onClick={handleSkipForward}
                disabled={audioSources.length <= 1}
              >
                <SkipForward className="h-7 w-7" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white transition-all hover:scale-110"
              >
                <Repeat className="h-6 w-6 text-blue-400" />
              </Button>
            </div>

            {/* Desktop Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm text-gray-400 font-mono">
                  {formatTime(sliderPosition)}
                </span>
                <div className="flex flex-col items-center justify-center gap-4 flex-1">
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
                    leftIcon={<div className="w-1 h-1 bg-gray-400 rounded-full" />}
                    rightIcon={<div className="w-1 h-1 bg-gray-400 rounded-full" />}
                    showValue={false}
                    className="w-full max-w-xs"
                  />
                </div>
                <span className="text-sm text-gray-400 font-mono">
                  {formatTime(trackDuration)}
                </span>
              </div>
            </div>

            {/* Desktop Volume Control */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white transition-all hover:scale-110"
                onClick={toggleMute}
                style={{ marginRight: '23px' }}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </Button>
              <div className="flex flex-col items-center justify-center gap-4 w-56">
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
                  className="w-full"
                  style={{ marginRight: '50px' }}
                />
              </div>
            </div>

            {/* Desktop Queue Info */}
            <div className="text-center text-gray-500">
              <p className="text-sm">
                {audioSources.length} {audioSources.length === 1 ? 'track' : 'tracks'} in queue
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
