const axios = require('axios');

class CloudflareClient {
  constructor(apiToken, accountId) {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.baseURL = 'https://api.cloudflare.com/client/v4';
  }

  async getTunnels() {
    try {
      const response = await axios.get(`${this.baseURL}/accounts/${this.accountId}/cfd_tunnel`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.data.success) {
        throw new Error(`API Error: ${response.data.errors?.[0]?.message || 'Unknown error'}`);
      }
      
      return response.data.result;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid API token or insufficient permissions');
      }
      if (error.response?.status === 403) {
        throw new Error('Access denied - check account permissions');
      }
      throw new Error(`Failed to fetch tunnels: ${error.message}`);
    }
  }

  async getTunnelStatus(tunnelName) {
    try {
      const tunnels = await this.getTunnels();
      
      // Try exact match first
      let tunnel = tunnels.find(t => t.name === tunnelName);
      
      // If not found, try case-insensitive partial match
      if (!tunnel) {
        const searchName = tunnelName.toLowerCase();
        tunnel = tunnels.find(t => {
          const name = t.name?.toLowerCase() || '';
          return name.includes(searchName) || searchName.includes(name);
        });
      }
      
      if (!tunnel) {
        const availableTunnels = tunnels.map(t => `"${t.name}"`).join(', ');
        throw new Error(`Tunnel ${tunnelName} not found. Available tunnels: ${availableTunnels}`);
      }

      // Determine online status based on tunnel state
      const isOnline = this.determineTunnelStatus(tunnel);

      return {
        id: tunnel.id,
        name: tunnel.name,
        online: isOnline,
        status: tunnel.status,
        createdAt: tunnel.created_at,
        connections: tunnel.connections || [],
        connsActiveAt: tunnel.conns_active_at,
        connsInactiveAt: tunnel.conns_inactive_at
      };
    } catch (error) {
      throw new Error(`Failed to get tunnel status: ${error.message}`);
    }
  }

  determineTunnelStatus(tunnel) {
    // Primary check: tunnel status - Cloudflare uses 'healthy', 'degraded', 'down', 'inactive'
    if (tunnel.status === 'healthy') {
      return true;
    }
    
    // For degraded, down, or inactive status, use backup checks to avoid false positives
    if (tunnel.status === 'degraded' || tunnel.status === 'down' || tunnel.status === 'inactive') {
      console.log(`Tunnel status is ${tunnel.status}, checking backup conditions`);
      
      // Secondary check: recent connection activity (within 5 minutes for degraded/down status)
      if (tunnel.conns_active_at) {
        const lastActiveDate = new Date(tunnel.conns_active_at);
        const now = new Date();
        const minutesAgo = (now - lastActiveDate) / (1000 * 60);
        
        // For degraded status, be more lenient with recent activity
        const activityThreshold = tunnel.status === 'degraded' ? 5 : 2;
        
        if (minutesAgo < activityThreshold) {
          console.log(`Tunnel status is ${tunnel.status} but was recently active (${Math.floor(minutesAgo)} minutes ago), considering online`);
          return true;
        }
      }
      
      // Tertiary check: active connections
      if (tunnel.connections && tunnel.connections.length > 0) {
        const activeConnections = tunnel.connections.filter(conn => 
          conn.is_pending_reconnect === false || conn.is_pending_reconnect === undefined
        );
        
        if (activeConnections.length > 0) {
          console.log(`Tunnel status is ${tunnel.status} but has ${activeConnections.length} active connections, considering online`);
          return true;
        }
      }
      
      // If status is degraded/down/inactive and no backup conditions met, consider offline
      console.log(`Tunnel status is ${tunnel.status} with no active connections or recent activity, considering offline`);
      return false;
    }
    
    // For any other unknown status, use backup checks
    console.log(`Unknown tunnel status: ${tunnel.status}, using backup checks`);
    
    // Secondary check: recent connection activity
    if (tunnel.conns_active_at) {
      const lastActiveDate = new Date(tunnel.conns_active_at);
      const now = new Date();
      const minutesAgo = (now - lastActiveDate) / (1000 * 60);
      
      if (minutesAgo < 10) {
        console.log(`Tunnel was recently active (${Math.floor(minutesAgo)} minutes ago), considering online`);
        return true;
      }
    }
    
    // Tertiary check: active connections
    if (tunnel.connections && tunnel.connections.length > 0) {
      const activeConnections = tunnel.connections.filter(conn => 
        conn.is_pending_reconnect === false || conn.is_pending_reconnect === undefined
      );
      
      if (activeConnections.length > 0) {
        console.log(`Tunnel has ${activeConnections.length} active connections, considering online`);
        return true;
      }
    }
    
    return false;
  }

  async isTunnelOnline(tunnelName) {
    try {
      const status = await this.getTunnelStatus(tunnelName);
      return status.online;
    } catch (error) {
      console.error(`Error checking tunnel status: ${error.message}`);
      return false;
    }
  }

  async testConnection() {
    try {
      await this.getTunnels();
      return { success: true, message: 'Connected successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = CloudflareClient;