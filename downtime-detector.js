const TailscaleClient = require('./tailscale-client');
const CloudflareClient = require('./cloudflare-client');
const WhatsAppClient = require('./whatsapp-client');

class DowntimeDetector {
  constructor(config) {
    this.config = config;
    
    // Initialize the appropriate client based on configuration
    if (config.tailscale.apiKey && config.tailscale.tailnet) {
      this.networkClient = new TailscaleClient(config.tailscale.apiKey, config.tailscale.tailnet);
      this.clientType = 'tailscale';
    } else if (config.cloudflare.apiToken && config.cloudflare.accountId) {
      this.networkClient = new CloudflareClient(config.cloudflare.apiToken, config.cloudflare.accountId);
      this.clientType = 'cloudflare';
    } else {
      throw new Error('No valid network client configuration found');
    }
    
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
      const targetName = this.clientType === 'cloudflare' 
        ? this.config.cloudflare.tunnelName 
        : this.config.device.name;
      
      const isOnline = this.clientType === 'cloudflare'
        ? await this.networkClient.isTunnelOnline(targetName)
        : await this.networkClient.isDeviceOnline(targetName);
      
      const now = new Date();
      
      if (isOnline) {
        if (!this.deviceState.isOnline) {
          const downtimeDuration = Math.floor((now - this.deviceState.downSince) / (1000 * 60));
          console.log(`${this.clientType === 'cloudflare' ? 'Tunnel' : 'Device'} ${targetName} is back online after ${downtimeDuration} minutes`);
          
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
          console.log(`${this.clientType === 'cloudflare' ? 'Tunnel' : 'Device'} ${targetName} went offline`);
          this.deviceState.isOnline = false;
          this.deviceState.downSince = now;
          this.deviceState.alertSent = false;
          this.deviceState.lastAlertTime = null;
          this.deviceState.recoveryNotificationSent = false;
        } else {
          const downtimeDuration = Math.floor((now - this.deviceState.downSince) / (1000 * 60));
          
          // Send initial alert after threshold is reached
          if (downtimeDuration >= this.config.alertThreshold.minutes && !this.deviceState.alertSent) {
            console.log(`${this.clientType === 'cloudflare' ? 'Tunnel' : 'Device'} has been offline for ${downtimeDuration} minutes, sending initial alert`);
            await this.sendDowntimeAlert(downtimeDuration);
            this.deviceState.alertSent = true;
            this.deviceState.lastAlertTime = now;
          }
          
          // Send repeat alerts at configured interval
          if (this.deviceState.alertSent && this.deviceState.lastAlertTime) {
            const minutesSinceLastAlert = Math.floor((now - this.deviceState.lastAlertTime) / (1000 * 60));
            if (minutesSinceLastAlert >= this.config.notifications.repeatAlertInterval) {
              console.log(`${this.clientType === 'cloudflare' ? 'Tunnel' : 'Device'} still offline after ${downtimeDuration} minutes, sending repeat alert`);
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
      const targetName = this.clientType === 'cloudflare' 
        ? this.config.cloudflare.tunnelName 
        : this.config.device.name;
      
      const results = await this.whatsappClient.sendDowntimeAlert(
        this.config.notifications.phoneNumbers,
        targetName,
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
      const targetName = this.clientType === 'cloudflare' 
        ? this.config.cloudflare.tunnelName 
        : this.config.device.name;
      
      const results = await this.whatsappClient.sendRecoveryNotification(
        this.config.notifications.phoneNumbers,
        targetName,
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
    const targetName = this.clientType === 'cloudflare' 
      ? this.config.cloudflare.tunnelName 
      : this.config.device.name;
    
    if (this.deviceState.isOnline) {
      console.log(`[${timestamp}] ${targetName}: ${status}`);
    } else {
      const downtimeDuration = Math.floor((new Date() - this.deviceState.downSince) / (1000 * 60));
      console.log(`[${timestamp}] ${targetName}: ${status} (${downtimeDuration} minutes)`);
    }
  }

  destroy() {
    this.whatsappClient.destroy();
  }
}

module.exports = DowntimeDetector;