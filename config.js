require('dotenv').config();

function loadConfig() {
  const config = {
    tailscale: {
      apiKey: process.env.TAILSCALE_API_KEY,
      tailnet: process.env.TAILSCALE_TAILNET
    },
    device: {
      name: process.env.DEVICE_NAME || 'apple-tv'
    },
    notifications: {
      phoneNumber: process.env.VENDOR_PHONE_NUMBER
    },
    alertThreshold: {
      minutes: parseInt(process.env.ALERT_THRESHOLD_MINUTES) || 5
    },
    checkInterval: {
      minutes: parseInt(process.env.CHECK_INTERVAL_MINUTES) || 5,
      cronExpression: process.env.CRON_EXPRESSION || null
    }
  };
  
  validateConfig(config);
  return config;
}

function validateConfig(config) {
  const required = [
    { key: 'TAILSCALE_API_KEY', value: config.tailscale.apiKey },
    { key: 'TAILSCALE_TAILNET', value: config.tailscale.tailnet },
    { key: 'DEVICE_NAME', value: config.device.name },
    { key: 'VENDOR_PHONE_NUMBER', value: config.notifications.phoneNumber }
  ];
  
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