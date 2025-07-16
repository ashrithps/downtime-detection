const cron = require('node-cron');
const { loadConfig } = require('./config');
const DowntimeDetector = require('./downtime-detector');
const ApiServer = require('./api-server');

class DowntimeMonitor {
  constructor() {
    this.config = loadConfig();
    this.detector = null;
    this.cronJob = null;
    this.apiServer = null;
  }

  async start() {
    console.log('Starting downtime monitoring system...');
    
    // Determine which provider is being used
    const usingCloudflare = this.config.cloudflare.apiToken && this.config.cloudflare.accountId;
    const usingTailscale = this.config.tailscale.apiKey && this.config.tailscale.tailnet;
    
    if (usingCloudflare) {
      console.log(`🔄 Provider: Cloudflare Tunnels`);
      console.log(`📍 Monitoring tunnel: ${this.config.cloudflare.tunnelName}`);
    } else if (usingTailscale) {
      console.log(`🔄 Provider: Tailscale`);
      console.log(`📍 Monitoring device: ${this.config.device.name}`);
    }
    
    console.log(`⏰ Check interval: ${this.config.checkInterval.minutes} minutes`);
    console.log(`🚨 Alert threshold: ${this.config.alertThreshold.minutes} minutes`);
    console.log(`📱 Notification phones: ${this.config.notifications.phoneNumbers.join(', ')}`);
    console.log('---');

    await this.checkSystemStatus();

    this.detector = new DowntimeDetector(this.config);

    // Run initial check to show current status
    console.log('🔍 Running initial status check...');
    await this.detector.checkDeviceStatus();

    // Wait for WhatsApp client to be ready before starting API server
    console.log('⏳ Waiting for WhatsApp client to be ready...');
    await this.detector.whatsappClient.waitForReady();
    console.log('✅ WhatsApp client is ready, starting API server...');
    
    // Send test message to first phone number
    if (this.config.notifications.phoneNumbers.length > 0) {
      try {
        await this.detector.whatsappClient.sendMessage(
          this.config.notifications.phoneNumbers[0], 
          '✅ WhatsApp monitoring system is now active and ready!'
        );
        console.log(`✅ Test message sent to ${this.config.notifications.phoneNumbers[0]}`);
      } catch (error) {
        console.error('❌ Failed to send test message:', error.message);
      }
    }

    // Start API server
    this.apiServer = new ApiServer(this.detector.whatsappClient);
    this.apiServer.start();

    this.cronJob = cron.schedule(this.config.checkInterval.cronExpression, async () => {
      console.log(`🔍 [${new Date().toISOString()}] Running scheduled check...`);
      await this.detector.checkDeviceStatus();
    });

    this.cronJob.start();
    console.log('Monitoring started. Press Ctrl+C to stop.');

    process.on('SIGINT', () => {
      console.log('\nShutting down gracefully...');
      this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\nShutting down gracefully...');
      this.stop();
      process.exit(0);
    });
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('Monitoring stopped.');
    }
    
    if (this.apiServer) {
      this.apiServer.stop();
    }
    
    if (this.detector) {
      this.detector.destroy();
    }
  }

  async checkSystemStatus() {
    console.log('Checking system status...');
    
    // Determine which provider to check
    const usingCloudflare = this.config.cloudflare.apiToken && this.config.cloudflare.accountId;
    const usingTailscale = this.config.tailscale.apiKey && this.config.tailscale.tailnet;
    
    if (usingCloudflare) {
      // Check Cloudflare API
      const CloudflareClient = require('./cloudflare-client');
      const cloudflareClient = new CloudflareClient(this.config.cloudflare.apiToken, this.config.cloudflare.accountId);
      
      console.log('🌐 Cloudflare API: Testing connection...');
      const cloudflareStatus = await cloudflareClient.testConnection();
      
      if (cloudflareStatus.success) {
        console.log('✅ Cloudflare API: Connected successfully');
        
        // Check if target tunnel exists
        try {
          const tunnelStatus = await cloudflareClient.getTunnelStatus(this.config.cloudflare.tunnelName);
          console.log(`🚇 Target Tunnel (${this.config.cloudflare.tunnelName}): Found - Status: ${tunnelStatus.status.toUpperCase()} (${tunnelStatus.online ? 'ONLINE' : 'OFFLINE'})`);
          console.log(`🔗 Active Connections: ${tunnelStatus.connections.length}`);
        } catch (error) {
          console.log(`❌ Target Tunnel (${this.config.cloudflare.tunnelName}): ${error.message}`);
        }
      } else {
        console.log(`❌ Cloudflare API: ${cloudflareStatus.message}`);
      }
    } else if (usingTailscale) {
      // Check Tailscale API
      const TailscaleClient = require('./tailscale-client');
      const tailscaleClient = new TailscaleClient(this.config.tailscale.apiKey, this.config.tailscale.tailnet);
      
      console.log('📡 Tailscale API: Testing connection...');
      const tailscaleStatus = await tailscaleClient.testConnection();
      
      if (tailscaleStatus.success) {
        console.log('✅ Tailscale API: Connected successfully');
        
        // Check if target device exists
        try {
          const deviceStatus = await tailscaleClient.getDeviceStatus(this.config.device.name);
          console.log(`📱 Target Device (${this.config.device.name}): Found - Status: ${deviceStatus.online ? 'ONLINE' : 'OFFLINE'}`);
        } catch (error) {
          console.log(`❌ Target Device (${this.config.device.name}): ${error.message}`);
        }
      } else {
        console.log(`❌ Tailscale API: ${tailscaleStatus.message}`);
      }
    }
    
    // WhatsApp connection will be checked when DowntimeDetector is created
    console.log('📱 WhatsApp: Will be initialized with monitoring system');
    
    console.log('---');
  }

  async runSingleCheck() {
    console.log('Running single device check...');
    await this.checkSystemStatus();
    
    if (!this.detector) {
      this.detector = new DowntimeDetector(this.config);
    }
    
    await this.detector.checkDeviceStatus();
  }
}

const monitor = new DowntimeMonitor();

const args = process.argv.slice(2);
if (args.includes('--check')) {
  monitor.runSingleCheck().then(() => {
    console.log('Single check completed.');
    monitor.stop();
    process.exit(0);
  }).catch(error => {
    console.error('Error during single check:', error.message);
    monitor.stop();
    process.exit(1);
  });
} else {
  monitor.start().catch(error => {
    console.error('Error starting monitor:', error.message);
    process.exit(1);
  });
}