const TailscaleClient = require('./tailscale-client');
const WhatsAppClient = require('./whatsapp-client');

class DowntimeDetector {
  constructor(config) {
    this.config = config;
    this.tailscaleClient = new TailscaleClient(config.tailscale.apiKey, config.tailscale.tailnet);
    this.whatsappClient = new WhatsAppClient();
    
    this.deviceState = {
      isOnline: true,
      lastOnlineTime: new Date(),
      downSince: null,
      alertSent: false,
      recoveryNotificationSent: false
    };
  }

  async checkDeviceStatus() {
    try {
      const isOnline = await this.tailscaleClient.isDeviceOnline(this.config.device.name);
      const now = new Date();
      
      if (isOnline) {
        if (!this.deviceState.isOnline) {
          const downtimeDuration = Math.floor((now - this.deviceState.downSince) / (1000 * 60));
          console.log(`Device ${this.config.device.name} is back online after ${downtimeDuration} minutes`);
          
          if (this.deviceState.alertSent && !this.deviceState.recoveryNotificationSent) {
            await this.sendRecoveryNotification(downtimeDuration);
            this.deviceState.recoveryNotificationSent = true;
          }
          
          this.deviceState.isOnline = true;
          this.deviceState.lastOnlineTime = now;
          this.deviceState.downSince = null;
          this.deviceState.alertSent = false;
          this.deviceState.recoveryNotificationSent = false;
        }
      } else {
        if (this.deviceState.isOnline) {
          console.log(`Device ${this.config.device.name} went offline`);
          this.deviceState.isOnline = false;
          this.deviceState.downSince = now;
          this.deviceState.alertSent = false;
          this.deviceState.recoveryNotificationSent = false;
        } else {
          const downtimeDuration = Math.floor((now - this.deviceState.downSince) / (1000 * 60));
          
          if (downtimeDuration >= this.config.alertThreshold.minutes && !this.deviceState.alertSent) {
            console.log(`Device has been offline for ${downtimeDuration} minutes, sending alert`);
            await this.sendDowntimeAlert(downtimeDuration);
            this.deviceState.alertSent = true;
          }
        }
      }
      
      this.logStatus();
    } catch (error) {
      console.error('Error checking device status:', error.message);
    }
  }

  async sendDowntimeAlert(downtimeDuration) {
    try {
      const success = await this.whatsappClient.sendDowntimeAlert(
        this.config.notifications.phoneNumber,
        this.config.device.name,
        downtimeDuration
      );
      
      if (success) {
        console.log('Downtime alert sent successfully');
      } else {
        console.error('Failed to send downtime alert');
      }
    } catch (error) {
      console.error('Error sending downtime alert:', error.message);
    }
  }

  async sendRecoveryNotification(downtimeDuration) {
    try {
      const success = await this.whatsappClient.sendRecoveryNotification(
        this.config.notifications.phoneNumber,
        this.config.device.name,
        downtimeDuration
      );
      
      if (success) {
        console.log('Recovery notification sent successfully');
      } else {
        console.error('Failed to send recovery notification');
      }
    } catch (error) {
      console.error('Error sending recovery notification:', error.message);
    }
  }

  logStatus() {
    const status = this.deviceState.isOnline ? 'ONLINE' : 'OFFLINE';
    const timestamp = new Date().toLocaleString();
    
    if (this.deviceState.isOnline) {
      console.log(`[${timestamp}] ${this.config.device.name}: ${status}`);
    } else {
      const downtimeDuration = Math.floor((new Date() - this.deviceState.downSince) / (1000 * 60));
      console.log(`[${timestamp}] ${this.config.device.name}: ${status} (${downtimeDuration} minutes)`);
    }
  }

  destroy() {
    this.whatsappClient.destroy();
  }
}

module.exports = DowntimeDetector;