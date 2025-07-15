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
    console.log(`Monitoring device: ${this.config.device.name}`);
    console.log(`Check interval: ${this.config.checkInterval.minutes} minutes`);
    console.log(`Alert threshold: ${this.config.alertThreshold.minutes} minutes`);
    console.log(`Notification phone: ${this.config.notifications.phoneNumber}`);
    console.log('---');

    await this.checkSystemStatus();

    this.detector = new DowntimeDetector(this.config);

    // Start API server
    this.apiServer = new ApiServer(this.detector.whatsappClient);
    this.apiServer.start();

    this.cronJob = cron.schedule(this.config.checkInterval.cronExpression, async () => {
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
    
    // Check WhatsApp connection
    const WhatsAppClient = require('./whatsapp-client');
    const whatsappClient = new WhatsAppClient();
    
    console.log('📱 WhatsApp: Initializing connection...');
    
    try {
      await whatsappClient.waitForReady(30000);
      console.log('✅ WhatsApp: Connected and ready');
    } catch (error) {
      console.log(`❌ WhatsApp: ${error.message}`);
    }
    
    const whatsappStatus = whatsappClient.getStatus();
    if (!whatsappStatus.ready) {
      console.log(`⚠️  WhatsApp: ${whatsappStatus.message}`);
    }
    
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