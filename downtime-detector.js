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
      lastAlertTime: null,
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
          this.deviceState.lastAlertTime = null;
          this.deviceState.recoveryNotificationSent = false;
        }
      } else {
        if (this.deviceState.isOnline) {
          console.log(`Device ${this.config.device.name} went offline`);
          this.deviceState.isOnline = false;
          this.deviceState.downSince = now;
          this.deviceState.alertSent = false;
          this.deviceState.lastAlertTime = null;
          this.deviceState.recoveryNotificationSent = false;
        } else {
          const downtimeDuration = Math.floor((now - this.deviceState.downSince) / (1000 * 60));
          
          // Send initial alert after threshold is reached
          if (downtimeDuration >= this.config.alertThreshold.minutes && !this.deviceState.alertSent) {
            console.log(`Device has been offline for ${downtimeDuration} minutes, sending initial alert`);
            await this.sendDowntimeAlert(downtimeDuration);
            this.deviceState.alertSent = true;
            this.deviceState.lastAlertTime = now;
          }
          
          // Send repeat alerts at configured interval
          if (this.deviceState.alertSent && this.deviceState.lastAlertTime) {
            const minutesSinceLastAlert = Math.floor((now - this.deviceState.lastAlertTime) / (1000 * 60));
            if (minutesSinceLastAlert >= this.config.notifications.repeatAlertInterval) {
              console.log(`Device still offline after ${downtimeDuration} minutes, sending repeat alert`);
              await this.sendDowntimeAlert(downtimeDuration);
              this.deviceState.lastAlertTime = now;
            }
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
      const results = await this.whatsappClient.sendDowntimeAlert(
        this.config.notifications.phoneNumbers,
        this.config.device.name,
        downtimeDuration,
        this.config.notifications.downtimeAlertMessage
      );
      
      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        console.log(`Downtime alert sent successfully to ${successCount} recipients`);
      } else {
        console.error('Failed to send downtime alert to any recipients');
      }
    } catch (error) {
      console.error('Error sending downtime alert:', error.message);
    }
  }

  async sendRecoveryNotification(downtimeDuration) {
    try {
      const results = await this.whatsappClient.sendRecoveryNotification(
        this.config.notifications.phoneNumbers,
        this.config.device.name,
        downtimeDuration,
        this.config.notifications.recoveryMessage
      );
      
      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        console.log(`Recovery notification sent successfully to ${successCount} recipients`);
      } else {
        console.error('Failed to send recovery notification to any recipients');
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