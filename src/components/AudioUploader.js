'use client';

import { CloudUpload, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { createPlaceholderCoverArt, extractAudioMetadata } from '../lib/audioMetadata';
import { uploadAudioFileR2 } from '../lib/r2-api';
import { cn, trimFileName } from '../lib/utils';
import { useGlobalStore } from '../store/global';
import { useRoomStore } from '../store/room';
import { Button } from './ui/button';

export default function AudioUploader({ className, ...rest }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState(null);
  const addAudioSource = useGlobalStore((state) => state.addAudioSource);
  const socket = useGlobalStore((state) => state.socket);
  const roomId = useRoomStore((state) => state.roomId);

  const handleFileUpload = async (file) => {
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    if (!roomId) {
      toast.error('Please join a room first');
      return;
    }

    setFileName(file.name);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(5);
      toast.info('Extracting metadata...');
      
      // Extract metadata from the file before uploading
      const arrayBuffer = await file.arrayBuffer();
      setUploadProgress(15);
      
      // Extract metadata (including cover art)
      const metadata = await extractAudioMetadata(arrayBuffer, file.name);
      setUploadProgress(25);
      
      toast.success(`Found: ${metadata.title} by ${metadata.artist}`);
      
      // Upload using R2 (3-step process)
      const result = await uploadAudioFileR2({
        file,
        roomId,
        metadata, // Pass metadata to the upload function
      });

      setUploadProgress(90);

      // The server will broadcast the new audio source to all clients
      // including this one, so we don't need to add it manually here
      
      setUploadProgress(100);
      toast.success(`Successfully uploaded: ${file.name}`);
      
      setTimeout(() => {
        setFileName(null);
        setUploadProgress(0);
      }, 3000);
      
    } catch (error) {
      toast.error(error.message || 'Failed to upload audio file');
      setFileName(null);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleFileUpload(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    handleFileUpload(file);
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed border-gray-600 rounded-lg p-6 text-center transition-colors relative overflow-hidden",
        isDragging ? "border-blue-400 bg-blue-400/10" : "hover:border-gray-500",
        isUploading && "pointer-events-none",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      {...rest}
    >
      {/* Progress bar */}
      {isUploading && (
        <div 
          className="absolute top-0 left-0 h-1 bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${uploadProgress}%` }} 
        />
      )}
      
      <input
        type="file"
        accept="audio/*"
        onChange={handleInputChange}
        className="hidden"
        id="audio-upload"
        disabled={isUploading}
      />
      
      <label htmlFor="audio-upload" className="cursor-pointer">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
            {isUploading ? (
              <CloudUpload className="w-8 h-8 text-blue-400 animate-pulse" />
            ) : (
              <Plus className="w-8 h-8 text-blue-400" />
            )}
          </div>
          
          <div>
            <p className="text-lg font-medium text-white mb-1">
              {isUploading ? `Uploading... ${uploadProgress}%` : 'Upload Audio File'}
            </p>
            <p className="text-sm text-gray-400">
              {fileName ? trimFileName(fileName, 30) : 'Drag and drop or click to select'}
            </p>
            {!isUploading && (
              <p className="text-xs text-gray-500 mt-1">
                Supports all audio formats • Upload to cloud storage
              </p>
            )}
          </div>
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            className="pointer-events-none"
          >
            {isUploading ? `Processing... ${uploadProgress}%` : 'Choose File'}
          </Button>
        </div>
      </label>
    </div>
  );
}
