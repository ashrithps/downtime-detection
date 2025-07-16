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
    console.log('🔄 Initializing WhatsApp client...');
    
    this.client.on('qr', (qr) => {
      console.log('📱 QR code received, scan with WhatsApp app:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', async () => {
      console.log('✅ WhatsApp client is ready!');
      
      // Wait a moment for WhatsApp Web to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.isReady = true;
      this.resolveReady();
      
      // Send test message on startup (will be sent to first number in the list)
      // Note: Test message number will be determined by the calling code
      console.log('✅ WhatsApp client ready for messaging');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
      this.authFailed = true;
      this.rejectReady(new Error(`Authentication failed: ${msg}`));
    });

    this.client.on('disconnected', (reason) => {
      console.log('⚠️  WhatsApp client disconnected:', reason);
      this.isReady = false;
    });

    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp authentication successful');
    });

    console.log('🚀 Starting WhatsApp client initialization...');
    this.client.initialize();
  }

  async sendMessage(phoneNumber, message) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const formattedNumber = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
      console.log(`📤 Sending message to ${phoneNumber}...`);
      
      // Check if client is actually ready
      const info = await this.client.getState();
      console.log(`📱 WhatsApp client state: ${info}`);
      
      await this.client.sendMessage(formattedNumber, message);
      console.log(`✅ Message sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send message to ${phoneNumber}:`, error.message);
      console.error('❌ Error details:', error);
      
      // Reset ready state if there's an error
      if (error.message.includes('Session closed') || error.message.includes('not authenticated')) {
        this.isReady = false;
        console.log('⚠️  WhatsApp client state reset due to error');
      }
      
      return false;
    }
  }

  replacePlaceholders(template, deviceName, duration) {
    // Format timestamp in IST
    const now = new Date();
    const istTime = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return template
      .replace(/{{deviceName}}/g, deviceName)
      .replace(/{{duration}}/g, duration)
      .replace(/{{timestamp}}/g, istTime)
      .split('\\n').join('\n'); // Convert all \n sequences to actual newlines
  }

  async sendToMultipleRecipients(phoneNumbers, message) {
    const results = [];
    
    for (const phoneNumber of phoneNumbers) {
      try {
        const success = await this.sendMessage(phoneNumber, message);
        results.push({ phoneNumber, success });
      } catch (error) {
        console.error(`Failed to send to ${phoneNumber}:`, error.message);
        results.push({ phoneNumber, success: false, error: error.message });
      }
    }
    
    return results;
  }

  async sendDowntimeAlert(phoneNumbers, deviceName, duration, messageTemplate) {
    const message = this.replacePlaceholders(messageTemplate, deviceName, duration);
    const results = await this.sendToMultipleRecipients(phoneNumbers, message);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`Downtime alert sent to ${successCount}/${phoneNumbers.length} recipients`);
    
    return results;
  }

  async sendRecoveryNotification(phoneNumbers, deviceName, downtimeDuration, messageTemplate) {
    const message = this.replacePlaceholders(messageTemplate, deviceName, downtimeDuration);
    const results = await this.sendToMultipleRecipients(phoneNumbers, message);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`Recovery notification sent to ${successCount}/${phoneNumbers.length} recipients`);
    
    return results;
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