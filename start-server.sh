#!/bin/bash

# BeatsSurround Server Startup Script

echo "🚀 Starting BeatsSurround WebSocket Server..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo "🎵 Starting server on port 8080..."
npm run servertsSurround Server Startup Script

echo "🚀 Starting BeatsSurround WebSocket Server..."

# Install dependencies if needed
if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing server dependencies..."
    cd server
    npm install
    cd ..
fi

# Start the server
echo "🌐 Starting server on port 8080..."
cd server
npm start
