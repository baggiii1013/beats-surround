# Deployment Guide for BeatsSurround

## The Problem
Vercel is a **serverless platform** that doesn't support long-running WebSocket servers. Your BeatsSurround app needs a persistent WebSocket server for real-time synchronization.

## Solution: Deploy WebSocket Server Separately

### Option 1: Deploy to Heroku (Recommended)

1. **Prepare your server directory**:
   ```bash
   cd server/
   ```

2. **Initialize git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial server setup"
   ```

3. **Create Heroku app**:
   ```bash
   heroku create your-beatsurround-server
   ```

4. **Set environment variables**:
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set PORT=8080
   ```

5. **Deploy**:
   ```bash
   git push heroku main
   ```

6. **Update your .env.local**:
   ```env
   NEXT_PUBLIC_WS_URL=wss://your-beatsurround-server.herokuapp.com
   NEXT_PUBLIC_API_URL=https://your-beatsurround-server.herokuapp.com
   ```

### Option 2: Deploy to Railway

1. **Sign up at Railway.app**
2. **Connect your GitHub repository** (server folder)
3. **Set environment variables**:
   - `NODE_ENV=production`
   - `PORT=8080`
4. **Deploy automatically**

### Option 3: Deploy to Render

1. **Sign up at Render.com**
2. **Create a new Web Service**
3. **Connect your repository** (server folder)
4. **Set build command**: `npm install`
5. **Set start command**: `npm start`
6. **Set environment variables**:
   - `NODE_ENV=production`

## After Deployment

1. **Test your WebSocket server**:
   ```bash
   curl https://your-websocket-server.herokuapp.com/health
   ```

2. **Update your Vercel environment variables**:
   - Go to your Vercel dashboard
   - Navigate to your project settings
   - Add environment variables:
     - `NEXT_PUBLIC_WS_URL=wss://your-websocket-server.herokuapp.com`
     - `NEXT_PUBLIC_API_URL=https://your-websocket-server.herokuapp.com`

3. **Redeploy your Vercel app** to pick up the new environment variables

## Alternative: Use Vercel with External WebSocket

If you prefer to keep everything in one place, consider using:
- **Pusher** (WebSocket as a Service)
- **Socket.io** with a separate server
- **Firebase Realtime Database**
- **Supabase Realtime**

## Testing

1. **Local testing**:
   ```bash
   # Terminal 1: Start WebSocket server
   cd server && npm start
   
   # Terminal 2: Start Next.js app
   cd .. && npm run dev
   ```

2. **Production testing**:
   - WebSocket server: `https://your-server.herokuapp.com/health`
   - Next.js app: Your Vercel URL

## Troubleshooting

- **CORS issues**: Make sure your server allows your Vercel domain
- **WebSocket connection fails**: Check that you're using `wss://` (not `ws://`) in production
- **Environment variables not working**: Restart your Vercel deployment after adding variables
