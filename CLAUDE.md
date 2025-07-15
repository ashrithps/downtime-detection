# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js application that monitors internet connectivity by checking if an Apple TV device is online via the Tailscale API. When downtime is detected, it sends WhatsApp notifications to an internet vendor.

## Architecture

The application follows a modular architecture with these core components:

- **index.js**: Main entry point that orchestrates the monitoring system using cron jobs
- **config.js**: Environment-based configuration management with validation
- **downtime-detector.js**: Core business logic for tracking device state and triggering notifications
- **tailscale-client.js**: API client for Tailscale with device discovery and online status detection
- **whatsapp-client.js**: WhatsApp Web client for sending notifications using puppeteer

### Key State Management

The `DowntimeDetector` class maintains device state including:
- Online/offline status
- Downtime duration tracking
- Alert notification state (prevents duplicate alerts)
- Recovery notification state

### Device Detection Logic

The Tailscale client uses multi-layered device detection:
1. Exact name/hostname matching
2. Case-insensitive partial matching
3. Enhanced online status detection (API status + recent activity + IP assignment)

## Development Commands

```bash
# Install dependencies
npm install

# Start continuous monitoring
npm start

# Run single connectivity check
npm run check
```

## Environment Configuration

The application requires a `.env` file with:
- `TAILSCALE_API_KEY`: Tailscale API key
- `TAILSCALE_TAILNET`: Tailscale tailnet name
- `DEVICE_NAME`: Target device name (default: apple-tv)
- `VENDOR_PHONE_NUMBER`: WhatsApp number for notifications
- `ALERT_THRESHOLD_MINUTES`: Minutes before sending alert (default: 5)
- `CHECK_INTERVAL_MINUTES`: Check frequency in minutes (default: 5)
- `CRON_EXPRESSION`: Optional custom cron expression

## Key Implementation Details

- Uses `whatsapp-web.js` with LocalAuth for persistent WhatsApp sessions
- Implements graceful shutdown handlers (SIGINT/SIGTERM)
- Includes system status checks for both Tailscale API and WhatsApp connectivity
- Supports both scheduled monitoring and single-check modes
- Uses puppeteer in headless mode with sandbox disabled for container compatibility

## Error Handling

All external API calls (Tailscale, WhatsApp) are wrapped in try-catch blocks with appropriate error logging. The system continues monitoring even if individual checks fail.

## Container/Deployment Notes

The application is designed for containerized deployment (specifically mentions Coolify) with:
- QR code display in logs for initial WhatsApp setup
- Persistent storage requirements for WhatsApp authentication
- Environment variable-based configuration
- Restart policy recommendations for continuous monitoring