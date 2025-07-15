# Enhanced R2 Bucket Cleanup System

This document describes the advanced room cleanup system inspired by [BeatSync](https://github.com/freeman-jiang/beatsync) but with significant improvements for robustness, efficiency, and monitoring.

## 🎯 Overview

The cleanup system automatically manages R2 bucket storage by:
- **Scheduled Room Cleanup**: Removes room files after users disconnect with a configurable grace period
- **Orphaned Room Detection**: Finds and removes files for rooms that no longer exist in server memory
- **Graceful Reconnection**: Cancels cleanup if users reconnect during grace period
- **Batch Operations**: Efficiently deletes files in batches to minimize API calls
- **Monitoring & Health Checks**: Provides detailed status and manual control via API

## 🔧 Key Improvements Over BeatSync

### **1. Enhanced Reliability**
- **Retry Logic**: Failed cleanups retry with exponential backoff
- **Concurrency Control**: Limits simultaneous operations to prevent API overload  
- **Health Monitoring**: Continuous system health checks with issue detection
- **Error Isolation**: Individual room failures don't affect other operations

### **2. Better Performance**
- **Batch Deletion**: Up to 1000 files per R2 API call (vs. individual deletions)
- **Parallel Processing**: Concurrent cleanup with configurable limits
- **Smart Scheduling**: Different grace periods for normal vs. emergency scenarios
- **Memory Efficiency**: Streams large object lists instead of loading everything

### **3. Enhanced Monitoring**
- **Real-time Status**: Live dashboard showing cleanup statistics
- **Manual Controls**: API endpoints for triggering cleanup operations
- **Audit Trail**: Detailed logging of all cleanup activities
- **Dry Run Mode**: Test cleanup operations without actual deletion

### **4. Configurable Behavior**
- **Grace Periods**: Customizable delays before cleanup starts
- **Orphan Detection**: Configurable scan intervals for abandoned rooms
- **Safety Limits**: Maximum concurrent operations and retry attempts
- **Environment-specific**: Different settings for development vs. production

## 📋 Configuration

Add these environment variables to your `.env` file:

```bash
# Room cleanup grace period (default: 5 minutes)
ROOM_CLEANUP_GRACE_PERIOD=300000

# Orphan scan interval (default: 1 hour)  
ORPHAN_CHECK_INTERVAL=3600000

# Enable/disable automatic orphan cleanup
ENABLE_ORPHAN_CLEANUP=true

# Performance tuning
MAX_CONCURRENT_CLEANUPS=5
MAX_CLEANUP_RETRIES=3
```

## 🔄 How It Works

### **Room Lifecycle**
1. **Room Creation**: Room created when first user joins
2. **Active State**: Room exists with connected users
3. **Empty State**: Last user disconnects, cleanup timer starts
4. **Grace Period**: 5-minute window for user reconnection
5. **Cleanup**: Files deleted from R2, room removed from memory

### **Orphan Detection**
1. **Scheduled Scan**: Runs every hour (configurable)
2. **Comparison**: Lists R2 rooms vs. active server rooms
3. **Identification**: Finds rooms in R2 but not in memory
4. **Cleanup**: Removes orphaned room files automatically

### **Graceful Shutdown**
1. **Signal Reception**: SIGTERM/SIGINT received
2. **Connection Stop**: Stop accepting new connections
3. **Emergency Cleanup**: Clean all rooms with short grace period
4. **System Shutdown**: Close server after cleanup completes

## 🎛️ API Endpoints

### **GET /api/cleanup/status**
Get system health and statistics
```json
{
  "success": true,
  "health": {
    "healthy": true,
    "issues": []
  },
  "stats": {
    "totalCleanups": 42,
    "successfulCleanups": 40,
    "failedCleanups": 2,
    "filesDeleted": 1250,
    "activeCleanupTimers": 3,
    "lastOrphanCheck": "2025-01-15T10:30:00Z"
  }
}
```

### **GET /api/cleanup/orphans/scan**
Scan for orphaned rooms (dry run only)
```json
{
  "success": true,
  "mode": "scan-only",
  "activeRoomsInMemory": 15,
  "result": {
    "orphanedRooms": [
      {"roomId": "ABC123", "fileCount": 5},
      {"roomId": "XYZ789", "fileCount": 2}
    ],
    "totalFiles": 7
  }
}
```

### **POST /api/cleanup/orphans?dryRun=false**
Clean up orphaned rooms
```json
{
  "success": true,
  "mode": "live",
  "result": {
    "orphanedRooms": [{"roomId": "ABC123", "fileCount": 5}],
    "totalFiles": 5,
    "deletedFiles": 5,
    "errors": []
  }
}
```

### **POST /api/cleanup/room/:roomId?force=true**
Manually clean up a specific room
```json
{
  "success": true,
  "roomId": "ABC123",
  "result": {
    "success": true,
    "filesDeleted": 3,
    "duration": 1250
  }
}
```

## 📊 Monitoring Dashboard

The `CleanupMonitor` component provides a real-time dashboard showing:

- **System Health**: Overall status with issue detection
- **Statistics**: Cleanup counts, success rates, files processed
- **Orphan Management**: Scan and cleanup orphaned rooms
- **Manual Controls**: Trigger operations via UI

Add it to your admin interface:
```jsx
import CleanupMonitor from './components/CleanupMonitor';

function AdminDashboard() {
  return (
    <div>
      <h1>Server Administration</h1>
      <CleanupMonitor />
    </div>
  );
}
```

## 🚀 Usage Examples

### **Basic Integration**
The cleanup system is automatically integrated into your existing Room class:
```javascript
// When user disconnects
room.removeClient(clientId);
// -> Automatically schedules cleanup if room becomes empty

// When user reconnects  
room.addClient(clientId, client);
// -> Automatically cancels any pending cleanup
```

### **Manual Cleanup**
```bash
# Scan for orphaned rooms
curl http://localhost:8080/api/cleanup/orphans/scan

# Dry run cleanup
curl -X POST http://localhost:8080/api/cleanup/orphans?dryRun=true

# Actual cleanup
curl -X POST http://localhost:8080/api/cleanup/orphans?dryRun=false

# Force cleanup specific room
curl -X POST http://localhost:8080/api/cleanup/room/ABC123?force=true
```

### **Health Monitoring**
```bash
# Check system health
curl http://localhost:8080/api/cleanup/status

# Example response indicating issues
{
  "health": {
    "healthy": false,
    "issues": [
      "Too many concurrent cleanups: 8",
      "Orphan cleanup overdue"
    ]
  }
}
```

## ⚠️ Safety Features

### **Automatic Safeguards**
- **Grace Periods**: Users can reconnect and cancel cleanup
- **Double-checking**: Verifies room is still empty before deletion
- **Batch Limits**: Prevents overwhelming R2 API
- **Retry Logic**: Handles temporary failures gracefully

### **Manual Safeguards**
- **Dry Run Default**: Most operations default to dry run mode
- **Force Flags**: Require explicit confirmation for dangerous operations
- **Client Checks**: Won't clean rooms with active users (unless forced)
- **Size Limits**: Refuses to clean if too many active rooms (safety threshold)

### **Error Handling**
- **Individual Failures**: One room failure doesn't affect others
- **Graceful Degradation**: System continues working with partial failures
- **Detailed Logging**: All operations logged with success/failure reasons
- **Recovery**: Failed operations can be retried manually

## 🔍 Troubleshooting

### **Common Issues**

**"R2 configuration incomplete"**
- Check all R2 environment variables are set
- Verify R2 credentials have proper permissions

**"Too many concurrent cleanups"**
- Reduce `MAX_CONCURRENT_CLEANUPS` setting
- Check for stuck operations in status endpoint

**"Orphan cleanup overdue"**
- Check server logs for cleanup failures
- Manually trigger cleanup via API

**"Failed to delete room files"**
- Verify R2 bucket permissions
- Check network connectivity to R2
- Review error logs for specific failure reasons

### **Debugging Commands**
```bash
# Check system status
curl http://localhost:8080/api/cleanup/status | jq

# List orphaned rooms
curl http://localhost:8080/api/cleanup/orphans/scan | jq '.result.orphanedRooms'

# Force cleanup with detailed logging
curl -X POST "http://localhost:8080/api/cleanup/orphans?dryRun=false&force=true" | jq
```

## 📈 Performance Considerations

### **Optimizations**
- **Batch Operations**: Groups file deletions for efficiency
- **Parallel Processing**: Concurrent cleanup with limits
- **Smart Timing**: Staggered operations to avoid API rate limits
- **Memory Management**: Streams large file lists

### **Scaling Recommendations**
- **High Traffic**: Increase `MAX_CONCURRENT_CLEANUPS` to 10-20
- **Large Buckets**: Reduce `ORPHAN_CHECK_INTERVAL` for faster cleanup
- **Production**: Set `ROOM_CLEANUP_GRACE_PERIOD` to 300000 (5 min)
- **Development**: Set `ROOM_CLEANUP_GRACE_PERIOD` to 60000 (1 min)

## 🔐 Security Considerations

### **Access Control**
- Cleanup APIs have no authentication (add middleware as needed)
- Dry run operations are safe for any user
- Live cleanup operations should be admin-only

### **Data Protection**
- Grace periods prevent accidental data loss
- Dry run mode allows safe testing
- Manual confirmation required for destructive operations
- Detailed audit logs for compliance

---

## 🎉 Conclusion

This enhanced cleanup system provides enterprise-grade reliability and monitoring while maintaining the simplicity of BeatSync's core concept. The extensive configuration options and monitoring capabilities make it suitable for both development and production environments.

Key benefits:
- ✅ **Zero manual intervention** required for normal operations
- ✅ **Cost optimization** through automatic cleanup of unused storage
- ✅ **High reliability** with retry logic and error handling  
- ✅ **Full visibility** through monitoring dashboard and APIs
- ✅ **Safety first** with grace periods and confirmation requirements

The system is production-ready and will automatically keep your R2 bucket clean while providing the tools needed to monitor and control cleanup operations.
