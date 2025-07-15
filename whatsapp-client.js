const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class WhatsAppClient {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });
    
    this.isReady = false;
    this.authFailed = false;
    this.readyPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.initialize();
  }

  initialize() {
    this.client.on('qr', (qr) => {
      console.log('QR code received, scan with WhatsApp app:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      console.log('WhatsApp client is ready!');
      this.isReady = true;
      this.resolveReady();
    });

    this.client.on('auth_failure', (msg) => {
      console.error('Authentication failed:', msg);
      this.authFailed = true;
      this.rejectReady(new Error(`Authentication failed: ${msg}`));
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp client disconnected:', reason);
      this.isReady = false;
    });

    this.client.initialize();
  }

  async sendMessage(phoneNumber, message) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const formattedNumber = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
      await this.client.sendMessage(formattedNumber, message);
      console.log(`Message sent to ${phoneNumber}: ${message}`);
      return true;
    } catch (error) {
      console.error(`Failed to send message to ${phoneNumber}:`, error.message);
      return false;
    }
  }

  async sendDowntimeAlert(phoneNumber, deviceName, duration) {
    const message = `🚨 INTERNET DOWNTIME ALERT 🚨\n\nDevice: ${deviceName}\nStatus: OFFLINE\nDuration: ${duration} minutes\n\nPlease check the internet connection immediately.\n\nTime: ${new Date().toLocaleString()}`;
    
    return await this.sendMessage(phoneNumber, message);
  }

  async sendRecoveryNotification(phoneNumber, deviceName, downtimeDuration) {
    const message = `✅ INTERNET RECOVERED\n\nDevice: ${deviceName}\nStatus: ONLINE\nDowntime Duration: ${downtimeDuration} minutes\n\nConnection has been restored.\n\nTime: ${new Date().toLocaleString()}`;
    
    return await this.sendMessage(phoneNumber, message);
  }

  async waitForReady(timeout = 60000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('WhatsApp connection timeout'));
      }, timeout);

      this.readyPromise
        .then(() => {
          clearTimeout(timeoutId);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  getStatus() {
    if (this.authFailed) {
      return { ready: false, message: 'Authentication failed' };
    }
    if (this.isReady) {
      return { ready: true, message: 'Connected and ready' };
    }
    return { ready: false, message: 'Connecting...' };
  }

  destroy() {
    this.client.destroy();
  }
}

module.exports = WhatsAppClient;