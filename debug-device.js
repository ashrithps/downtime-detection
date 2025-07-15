const { loadConfig } = require('./config');
const TailscaleClient = require('./tailscale-client');

async function debugDevice() {
  try {
    const config = loadConfig();
    const client = new TailscaleClient(config.tailscale.apiKey, config.tailscale.tailnet);
    
    console.log('=== TAILSCALE DEVICE DEBUG ===');
    console.log(`Looking for device: "${config.device.name}"`);
    console.log('');
    
    // Get all devices
    const response = await client.getDevices();
    console.log('=== ALL DEVICES IN TAILNET ===');
    
    response.devices.forEach((device, index) => {
      console.log(`Device ${index + 1}:`);
      console.log(`  Name: "${device.name}"`);
      console.log(`  Hostname: "${device.hostname}"`);
      console.log(`  Online: ${device.online}`);
      console.log(`  Last Seen: ${device.lastSeen}`);
      console.log(`  Addresses: ${device.addresses?.join(', ')}`);
      console.log(`  OS: ${device.os}`);
      console.log(`  Machine Key: ${device.machineKey?.substring(0, 20)}...`);
      console.log('  ---');
    });
    
    console.log('=== DEVICE MATCHING TEST ===');
    const targetDevice = response.devices.find(d => 
      d.name === config.device.name || d.hostname === config.device.name
    );
    
    if (targetDevice) {
      console.log(`✅ Found device: "${targetDevice.name}" (hostname: "${targetDevice.hostname}")`);
      console.log(`   Status: ${targetDevice.online ? 'ONLINE' : 'OFFLINE'}`);
      console.log(`   Last Seen: ${targetDevice.lastSeen}`);
      console.log(`   Addresses: ${targetDevice.addresses?.join(', ')}`);
      
      // Check if device was recently seen
      if (targetDevice.lastSeen) {
        const lastSeenDate = new Date(targetDevice.lastSeen);
        const now = new Date();
        const minutesAgo = Math.floor((now - lastSeenDate) / (1000 * 60));
        console.log(`   Last seen ${minutesAgo} minutes ago`);
        
        if (minutesAgo < 10) {
          console.log(`   🟡 Device was recently active (< 10 minutes ago)`);
        }
      }
    } else {
      console.log(`❌ Device "${config.device.name}" not found!`);
      console.log('');
      console.log('=== POSSIBLE MATCHES ===');
      
      const possibleMatches = response.devices.filter(d => {
        const deviceName = config.device.name.toLowerCase();
        const name = d.name?.toLowerCase() || '';
        const hostname = d.hostname?.toLowerCase() || '';
        
        return name.includes(deviceName) || 
               hostname.includes(deviceName) ||
               name.includes('apple') ||
               hostname.includes('apple') ||
               name.includes('tv') ||
               hostname.includes('tv');
      });
      
      if (possibleMatches.length > 0) {
        console.log('Found potential matches:');
        possibleMatches.forEach(device => {
          console.log(`  - "${device.name}" (hostname: "${device.hostname}") - ${device.online ? 'ONLINE' : 'OFFLINE'}`);
        });
      } else {
        console.log('No potential matches found.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    
    if (error.message.includes('401')) {
      console.log('❌ Authentication failed. Check your API key.');
    } else if (error.message.includes('404')) {
      console.log('❌ Tailnet not found. Check your tailnet name.');
    }
  }
}

debugDevice();