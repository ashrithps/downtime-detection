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
      const device = devices.devices.find(d => 
        d.name === deviceName || d.hostname === deviceName
      );
      
      if (!device) {
        throw new Error(`Device ${deviceName} not found`);
      }

      return {
        name: device.name,
        hostname: device.hostname,
        online: device.online,
        lastSeen: device.lastSeen,
        ipAddresses: device.addresses
      };
    } catch (error) {
      throw new Error(`Failed to get device status: ${error.message}`);
    }
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