require('dotenv').config();

function loadConfig() {
  const config = {
    tailscale: {
      apiKey: process.env.TAILSCALE_API_KEY,
      tailnet: process.env.TAILSCALE_TAILNET
    },
    cloudflare: {
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      tunnelName: process.env.CLOUDFLARE_TUNNEL_NAME || process.env.DEVICE_NAME || 'apple-tv'
    },
    device: {
      name: process.env.DEVICE_NAME || 'apple-tv'
    },
    notifications: {
      phoneNumbers: process.env.VENDOR_PHONE_NUMBER ? process.env.VENDOR_PHONE_NUMBER.split(',').map(num => num.trim()) : [],
      downtimeAlertMessage: process.env.DOWNTIME_ALERT_MESSAGE || '🚨 INTERNET DOWNTIME ALERT 🚨\\n\\nDevice: {{deviceName}}\\nStatus: OFFLINE\\nDuration: {{duration}} minutes\\n\\nPlease check the internet connection immediately.\\n\\nTime: {{timestamp}}',
      recoveryMessage: process.env.RECOVERY_MESSAGE || '✅ INTERNET RECOVERED\\n\\nDevice: {{deviceName}}\\nStatus: ONLINE\\nDowntime Duration: {{duration}} minutes\\n\\nConnection has been restored.\\n\\nTime: {{timestamp}}',
      repeatAlertInterval: parseInt(process.env.REPEAT_ALERT_INTERVAL_MINUTES) || 60
    },
    alertThreshold: {
      minutes: parseInt(process.env.ALERT_THRESHOLD_MINUTES) || 5
    },
    checkInterval: {
      minutes: parseInt(process.env.CHECK_INTERVAL_MINUTES) || 5,
      cronExpression: process.env.CRON_EXPRESSION || null
    },
    api: {
      key: process.env.API_KEY,
      port: parseInt(process.env.API_PORT) || 3000
    }
  };
  
  validateConfig(config);
  return config;
}

function validateConfig(config) {
  // Check if using Tailscale or Cloudflare
  const usingTailscale = config.tailscale.apiKey && config.tailscale.tailnet;
  const usingCloudflare = config.cloudflare.apiToken && config.cloudflare.accountId;
  
  if (!usingTailscale && !usingCloudflare) {
    throw new Error('Must configure either Tailscale (TAILSCALE_API_KEY, TAILSCALE_TAILNET) or Cloudflare (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)');
  }
  
  if (usingTailscale && usingCloudflare) {
    throw new Error('Cannot use both Tailscale and Cloudflare configurations. Choose one.');
  }
  
  const required = [
    { key: 'DEVICE_NAME', value: config.device.name },
    { key: 'VENDOR_PHONE_NUMBER', value: config.notifications.phoneNumbers.length > 0 ? config.notifications.phoneNumbers.join(',') : null },
    { key: 'API_KEY', value: config.api.key }
  ];
  
  // Add provider-specific required fields
  if (usingTailscale) {
    required.push(
      { key: 'TAILSCALE_API_KEY', value: config.tailscale.apiKey },
      { key: 'TAILSCALE_TAILNET', value: config.tailscale.tailnet }
    );
  }
  
  if (usingCloudflare) {
    required.push(
      { key: 'CLOUDFLARE_API_TOKEN', value: config.cloudflare.apiToken },
      { key: 'CLOUDFLARE_ACCOUNT_ID', value: config.cloudflare.accountId }
    );
  }
  
  for (const field of required) {
    if (!field.value || field.value === '') {
      throw new Error(`Missing required environment variable: ${field.key}`);
    }
  }
  
  if (typeof config.alertThreshold.minutes !== 'number' || config.alertThreshold.minutes < 1) {
    throw new Error('ALERT_THRESHOLD_MINUTES must be a positive number');
  }
  
  if (typeof config.checkInterval.minutes !== 'number' || config.checkInterval.minutes < 1) {
    throw new Error('CHECK_INTERVAL_MINUTES must be a positive number');
  }
  
  if (!config.checkInterval.cronExpression) {
    const minutes = config.checkInterval.minutes;
    config.checkInterval.cronExpression = `*/${minutes} * * * *`;
  }
}

module.exports = { loadConfig };