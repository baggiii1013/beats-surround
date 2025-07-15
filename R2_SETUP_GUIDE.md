# Cloudflare R2 Setup Instructions

## 1. Get Your R2 Credentials

### Step 1: Create API Token
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click on "R2 Object Storage" in the sidebar
3. Click "Manage R2 API tokens"
4. Click "Create API token"
5. Select "R2 Token" template
6. Choose "Edit" permissions for Object Storage
7. Include your account resources
8. Create the token and **save it securely**

### Step 2: Get Configuration Values
After creating your R2 bucket `beats-surround-audio`, you need:

1. **S3_BUCKET_NAME**: `beats-surround-audio` (you already have this)

2. **S3_ENDPOINT**: 
   - Format: `https://ACCOUNT_ID.r2.cloudflarestorage.com`
   - Find your Account ID in Cloudflare dashboard (right sidebar)

3. **S3_PUBLIC_URL**: 
   - Go to your R2 bucket settings
   - Enable "Public access" 
   - Copy the "Public bucket URL" (format: `https://pub-XXXXX.r2.dev`)

4. **S3_ACCESS_KEY_ID** & **S3_SECRET_ACCESS_KEY**: 
   - These are the credentials from the API token you created

## 2. Configure Environment Variables

Edit `/server/.env` file:

```bash
# Cloudflare R2 Configuration
S3_BUCKET_NAME=beats-surround-audio
S3_PUBLIC_URL=https://pub-XXXXX.r2.dev
S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your_access_key_from_token
S3_SECRET_ACCESS_KEY=your_secret_key_from_token
```

## 3. Enable Public Access on Your Bucket

**Important**: You need to enable public access on your R2 bucket for audio streaming to work:

1. Go to your Cloudflare R2 dashboard
2. Click on your `beats-surround-audio` bucket
3. Go to "Settings" tab
4. Under "Public access", click "Allow Access"
5. This will give you the public URL you need for `S3_PUBLIC_URL`

## 4. Test Your Configuration

Start your server and check for any R2 configuration errors:

```bash
cd server
npm start
```

The server will log any R2 configuration issues on startup.

## 5. Security Notes

- Your R2 bucket will be publicly readable (required for audio streaming)
- API tokens are only used server-side and not exposed to clients
- Users upload directly to R2 using presigned URLs (no server bandwidth usage)
- Files are organized by room: `room-{roomId}/{filename}`

## 6. Cost Estimation

With Cloudflare R2:
- **Storage**: ~$0.015 per GB/month
- **Operations**: Minimal costs for API calls
- **Bandwidth**: $0 (R2 includes free egress)

For a typical music app:
- 100 songs × 5MB average = 500MB storage = ~$0.008/month
- Unlimited streaming to any number of users = $0 bandwidth cost

## 7. Troubleshooting

### Common Issues:

1. **"R2 configuration not complete"**
   - Check all environment variables are set
   - Verify bucket name matches exactly

2. **"Failed to generate upload URL"**
   - Check API token permissions include "Edit" for Object Storage
   - Verify endpoint URL format

3. **"Failed to fetch audio from R2"**
   - Ensure public access is enabled on bucket
   - Check public URL is correct

4. **CORS errors in browser**
   - R2 should automatically handle CORS for public buckets
   - If issues persist, add CORS policy in R2 bucket settings
