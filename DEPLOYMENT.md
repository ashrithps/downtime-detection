# Deployment Guide

## Coolify Deployment

### Prerequisites
- Coolify instance running
- GitHub repository connected
- Environment variables configured

### Step 1: Configure Environment Variables
Set these in your Coolify application environment:

```bash
TAILSCALE_API_KEY=your_tailscale_api_key
TAILSCALE_TAILNET=your_tailscale_tailnet
DEVICE_NAME=apple-tv
VENDOR_PHONE_NUMBER=919742462600
ALERT_THRESHOLD_MINUTES=5
CHECK_INTERVAL_MINUTES=5
```

### Step 2: Configure Persistent Storage
**CRITICAL**: You must configure persistent storage for WhatsApp session persistence.

In Coolify:
1. Go to your application → **Storage** tab
2. Add a new **Persistent Volume**:
   - **Name**: `whatsapp-session`
   - **Mount Path**: `/app/.wwebjs_auth`
   - **Host Path**: Leave empty (Coolify will manage)

### Step 3: Build Configuration
Coolify will automatically detect the `Dockerfile` and build the container.

Build settings:
- **Build Pack**: Docker
- **Dockerfile**: `Dockerfile` (auto-detected)
- **Build Context**: `.` (root directory)

### Step 4: Deploy
1. Click **Deploy** in Coolify
2. Monitor logs for:
   - `🔄 Initializing WhatsApp client...`
   - `🔐 WhatsApp authentication successful` (if session exists)
   - `📱 QR code received...` (if first time setup)
   - `✅ WhatsApp client is ready!`
   - `✅ Test message sent successfully to 919742462600`

### Step 5: First Time Setup (QR Code)
If it's the first deployment or session expired:
1. Check application logs
2. Scan the QR code with your phone's WhatsApp
3. Session will be saved to persistent storage
4. Future deployments won't require QR code

### Troubleshooting

#### No QR Code Appearing
- Check if persistent storage is properly configured
- Verify `/app/.wwebjs_auth` mount path
- Clear persistent storage if corrupted

#### Network Errors
- Ensure Coolify has internet access
- Check if WhatsApp Web is blocked by firewall
- Verify container has sufficient resources

#### Session Not Persisting
- Verify persistent volume is mounted at `/app/.wwebjs_auth`
- Check volume permissions
- Ensure volume survives container restarts

### Monitoring
- Check logs for emoji status indicators
- Test message should arrive at 919742462600 on startup
- Monitor for downtime alerts and recovery messages

### Container Resource Requirements
- **Memory**: 512MB minimum (1GB recommended)
- **CPU**: 0.5 cores minimum
- **Storage**: 100MB for session data