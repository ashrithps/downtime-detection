const axios = require('axios');

class TailscaleClient {
  constructor(apiKey, tailnet) {
    this.apiKey = apiKey;
    this.tailnet = tailnet;
    this.baseURL = 'https://api.tailscale.com/api/v2';
  }

  async getDevices() {
    try {
      const response = await axios.get(`${this.baseURL}/tailnet/${this.tailnet}/devices`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch devices: ${error.message}`);
    }
  }

  async getDeviceStatus(deviceName) {
    try {
      const devices = await this.getDevices();
      
      // Try exact match first
      let device = devices.devices.find(d => 
        d.name === deviceName || d.hostname === deviceName
      );
      
      // If not found, try case-insensitive partial match
      if (!device) {
        const searchName = deviceName.toLowerCase();
        device = devices.devices.find(d => {
          const name = d.name?.toLowerCase() || '';
          const hostname = d.hostname?.toLowerCase() || '';
          return name.includes(searchName) || 
                 hostname.includes(searchName) ||
                 searchName.includes(name) ||
                 searchName.includes(hostname);
        });
      }
      
      if (!device) {
        const availableDevices = devices.devices.map(d => `"${d.name}" (${d.hostname})`).join(', ');
        throw new Error(`Device ${deviceName} not found. Available devices: ${availableDevices}`);
      }

      // Enhanced online detection
      const isOnline = this.determineOnlineStatus(device);

      return {
        name: device.name,
        hostname: device.hostname,
        online: isOnline,
        rawOnline: device.online,
        lastSeen: device.lastSeen,
        ipAddresses: device.addresses,
        os: device.os
      };
    } catch (error) {
      throw new Error(`Failed to get device status: ${error.message}`);
    }
  }

  determineOnlineStatus(device) {
    // Primary check: API online status
    if (device.online) {
      return true;
    }
    
    // Secondary check: recently seen (within last 10 minutes)
    if (device.lastSeen) {
      const lastSeenDate = new Date(device.lastSeen);
      const now = new Date();
      const minutesAgo = (now - lastSeenDate) / (1000 * 60);
      
      if (minutesAgo < 10) {
        console.log(`Device was recently active (${Math.floor(minutesAgo)} minutes ago), considering online`);
        return true;
      }
    }
    
    // Tertiary check: has IP addresses assigned
    if (device.addresses && device.addresses.length > 0) {
      console.log(`Device has IP addresses assigned, might be online despite API status`);
    }
    
    return false;
  }

  async isDeviceOnline(deviceName) {
    try {
      const status = await this.getDeviceStatus(deviceName);
      return status.online;
    } catch (error) {
      console.error(`Error checking device status: ${error.message}`);
      return false;
    }
  }

  async testConnection() {
    try {
      await this.getDevices();
      return { success: true, message: 'Connected successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = TailscaleClient;