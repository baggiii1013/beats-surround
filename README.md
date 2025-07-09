# BeatsSurround 🎵

A modern multi-device audio synchronization web application built with Next.js, inspired by BeatSync. Experience real-time collaborative music playback with spatial audio positioning across multiple devices.

## ✨ Features

- **🎶 Multi-Device Audio Sync**: High-precision audio playback synchronization across connected devices
- **🎯 Spatial Audio**: Interactive 2D positioning system with draggable listening sources
- **📱 Real-Time Collaboration**: Room-based system for multiple users to join and control music
- **🎵 Interactive Music Queue**: Drag & drop file uploads with animated track selection
- **🎨 Modern Dark UI**: Beautiful, responsive interface with smooth animations
- **⚡ Fast & Responsive**: Built with Next.js 15 and optimized for performance

## 🚀 Quick Start

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Animations**: Framer Motion
- **Audio**: Web Audio API
- **Icons**: Lucide React
- **Notifications**: Sonner

## 🎵 How to Use

### 1. **Start a Session**
- The app automatically generates a unique room ID
- Share the room ID with others to join your session

### 2. **Upload Music**
- Drag & drop audio files into the upload area
- Supported formats: MP3, WAV, M4A, and other common audio formats
- Files are processed locally using the Web Audio API

### 3. **Control Playback**
- Use the central player controls to play, pause, and seek
- Skip between tracks or enable shuffle mode
- All controls are synchronized across connected devices

### 4. **Spatial Audio**
- Toggle spatial audio in the right panel
- Drag the listening source position to change audio perspective
- Watch as connected users appear as dots on the 2D grid

---

**Enjoy your synchronized music experience! 🎵**
