# Internet Downtime Detection System

A Node.js application that monitors your Apple TV's internet connection via Tailscale API and sends WhatsApp notifications to your internet vendor when downtime is detected.

## Features

- Monitors device connectivity through Tailscale API
- Configurable check intervals (default: 5 minutes)
- Configurable alert thresholds (default: 5 minutes)
- Automatic WhatsApp notifications for downtime alerts
- Recovery notifications when connection is restored
- Environment variable configuration

## Prerequisites

- Node.js (v14 or higher)
- Tailscale account with API access
- WhatsApp account for sending notifications
- Your Apple TV must be connected to Tailscale

## Installation

1. Clone or download this project
2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your settings:
   ```env
   # Tailscale Configuration
   TAILSCALE_API_KEY=your_tailscale_api_key_here
   TAILSCALE_TAILNET=your_tailnet_name_here

   # Device Configuration
   DEVICE_NAME=apple-tv

   # Notification Configuration
   VENDOR_PHONE_NUMBER=your_internet_vendor_phone_number

   # Monitoring Configuration
   ALERT_THRESHOLD_MINUTES=5
   CHECK_INTERVAL_MINUTES=5

   # Optional: Custom cron expression (leave empty to use CHECK_INTERVAL_MINUTES)
   # CRON_EXPRESSION=*/5 * * * *
   ```

### Getting Tailscale API Key

1. Go to [Tailscale Admin Console](https://login.tailscale.com/admin/settings/keys)
2. Generate a new API key with appropriate permissions
3. Copy the API key to your .env file

### Phone Number Format

Use international format without '+' sign: `1234567890` for US numbers, `911234567890` for international.

## Usage

### Start Monitoring

```bash
npm start
```

The application will:
1. Display a QR code for WhatsApp authentication (first time only)
2. Start monitoring your Apple TV's connectivity
3. Send alerts when downtime exceeds the threshold
4. Send recovery notifications when connection is restored

### Single Check

To run a single connectivity check without continuous monitoring:

```bash
npm run check
```

### Stop Monitoring

Press `Ctrl+C` to stop the monitoring system gracefully.

## How It Works

1. **Connectivity Check**: The system queries Tailscale API every 5 minutes (configurable) to check if your Apple TV is online
2. **Downtime Detection**: If the device is offline for more than 5 minutes (configurable), it triggers an alert
3. **WhatsApp Notification**: Sends a formatted message to your internet vendor's WhatsApp
4. **Recovery Notification**: When connection is restored, sends a recovery notification

## Message Format

**Downtime Alert:**
```
🚨 INTERNET DOWNTIME ALERT 🚨

Device: apple-tv
Status: OFFLINE
Duration: 5 minutes

Please check the internet connection immediately.

Time: 7/15/2025, 2:30:00 PM
```

**Recovery Notification:**
```
✅ INTERNET RECOVERED

Device: apple-tv
Status: ONLINE
Downtime Duration: 15 minutes

Connection has been restored.

Time: 7/15/2025, 2:45:00 PM
```

## Configuration Options

- `CHECK_INTERVAL_MINUTES`: How often to check connectivity (default: 5 minutes)
- `ALERT_THRESHOLD_MINUTES`: How long to wait before sending alert (default: 5 minutes)
- `CRON_EXPRESSION`: Custom cron expression for scheduling (optional)
- `DEVICE_NAME`: Name of your Apple TV in Tailscale
- `VENDOR_PHONE_NUMBER`: Vendor's WhatsApp number

## Troubleshooting

1. **WhatsApp Authentication**: On first run, scan the QR code with your WhatsApp app
2. **Device Not Found**: Ensure your Apple TV name matches the Tailscale device name
3. **API Errors**: Verify your Tailscale API key and tailnet name
4. **Message Delivery**: Check phone number format and WhatsApp connection

## Security Notes

- Keep your `.env` file secure and never commit it to version control
- API keys should be treated as passwords
- The application stores WhatsApp authentication locally

## Deployment in Coolify

This application is perfect for deployment in Coolify:

1. **Environment Variables**: Set all the required environment variables in Coolify's environment section
2. **QR Code Display**: The WhatsApp QR code will be displayed in the application logs during first-time setup
3. **Persistent Storage**: Make sure to configure persistent storage for WhatsApp authentication data
4. **Restart Policy**: Set restart policy to "always" to ensure continuous monitoring

### Required Environment Variables for Coolify:
```
TAILSCALE_API_KEY=your_api_key
TAILSCALE_TAILNET=your_tailnet
DEVICE_NAME=apple-tv
VENDOR_PHONE_NUMBER=vendor_phone_number
ALERT_THRESHOLD_MINUTES=5
CHECK_INTERVAL_MINUTES=5
```

## License

ISC