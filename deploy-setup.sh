#!/bin/bash

echo "🚀 BeatsSurround Deployment Setup"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the root directory of BeatsSurround"
    exit 1
fi

echo "📋 Deployment Checklist:"
echo ""
echo "1. ✅ Environment configuration created"
echo "2. ✅ WebSocket URLs updated to use environment variables"
echo "3. ✅ Server CORS configured for production"
echo ""

echo "🔧 Next Steps:"
echo ""
echo "1. Deploy your WebSocket server to Heroku/Railway/Render:"
echo "   cd server/"
echo "   # Follow the deployment guide in DEPLOYMENT_GUIDE.md"
echo ""
echo "2. Update your .env.local with production URLs:"
echo "   NEXT_PUBLIC_WS_URL=wss://your-server.herokuapp.com"
echo "   NEXT_PUBLIC_API_URL=https://your-server.herokuapp.com"
echo ""
echo "3. Update server CORS to allow your Vercel domain:"
echo "   Edit server/index.js line 14 to include your Vercel URL"
echo ""
echo "4. Deploy to Vercel with updated environment variables"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT_GUIDE.md"
echo ""

# Test current configuration
echo "🧪 Testing current local configuration..."
echo ""

# Check if server is running
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Local WebSocket server is running"
else
    echo "❌ Local WebSocket server is not running"
    echo "   Start it with: cd server && npm start"
fi

# Check if Next.js app builds
echo "🔨 Testing Next.js build..."
if npm run build > /dev/null 2>&1; then
    echo "✅ Next.js app builds successfully"
else
    echo "❌ Next.js app build failed"
    echo "   Check the build output for errors"
fi

echo ""
echo "🎉 Setup complete! See DEPLOYMENT_GUIDE.md for next steps."
