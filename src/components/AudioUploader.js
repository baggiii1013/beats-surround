'use client';

import { CloudUpload, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn, trimFileName } from '../lib/utils';
import { useGlobalStore } from '../store/global';
import { Button } from './ui/button';

export default function AudioUploader({ className, ...rest }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState(null);
  const addAudioSource = useGlobalStore((state) => state.addAudioSource);

  const handleFileUpload = async (file) => {
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    setFileName(file.name);
    setIsUploading(true);

    try {
      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Create audio source object
      const audioSource = {
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        audioBuffer: arrayBuffer,
        id: `upload-${Date.now()}-${Math.random().toString(36).substring(2)}`,
      };

      // Add to global store
      await addAudioSource(audioSource);
      
      toast.success(`Successfully uploaded: ${file.name}`);
      setTimeout(() => setFileName(null), 3000);
    } catch (error) {
      console.error('Error uploading audio file:', error);
      toast.error('Failed to upload audio file');
      setFileName(null);
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
        "border-2 border-dashed border-gray-600 rounded-lg p-6 text-center transition-colors",
        isDragging ? "border-blue-400 bg-blue-400/10" : "hover:border-gray-500",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      {...rest}
    >
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
              {isUploading ? 'Uploading...' : 'Upload Audio File'}
            </p>
            <p className="text-sm text-gray-400">
              {fileName ? trimFileName(fileName, 30) : 'Drag and drop or click to select'}
            </p>
          </div>
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            className="pointer-events-none"
          >
            {isUploading ? 'Processing...' : 'Choose File'}
          </Button>
        </div>
      </label>
    </div>
  );
}
