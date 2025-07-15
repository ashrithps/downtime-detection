const cron = require('node-cron');
const { loadConfig } = require('./config');
const DowntimeDetector = require('./downtime-detector');

class DowntimeMonitor {
  constructor() {
    this.config = loadConfig();
    this.detector = null;
    this.cronJob = null;
  }

  start() {
    console.log('Starting downtime monitoring system...');
    console.log(`Monitoring device: ${this.config.device.name}`);
    console.log(`Check interval: ${this.config.checkInterval.minutes} minutes`);
    console.log(`Alert threshold: ${this.config.alertThreshold.minutes} minutes`);
    console.log(`Notification phone: ${this.config.notifications.phoneNumber}`);
    console.log('---');

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
    
    if (this.detector) {
      this.detector.destroy();
    }
  }

  async runSingleCheck() {
    console.log('Running single device check...');
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
  monitor.start();
}