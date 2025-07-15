const express = require('express');
const { loadConfig } = require('./config');

class ApiServer {
  constructor(whatsappClient) {
    this.whatsappClient = whatsappClient;
    this.app = express();
    this.config = loadConfig();
    
    // Middleware
    this.app.use(express.json());
    this.setupRoutes();
  }

  // API Key authentication middleware
  authenticateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required', 
        message: 'Please provide API key in x-api-key header or Authorization header' 
      });
    }

    if (apiKey !== this.config.api?.key) {
      return res.status(403).json({ 
        error: 'Invalid API key', 
        message: 'The provided API key is invalid' 
      });
    }

    next();
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const whatsappStatus = this.whatsappClient.getStatus();
      res.json({
        status: 'ok',
        whatsapp: whatsappStatus,
        timestamp: new Date().toISOString()
      });
    });

    // Send WhatsApp message endpoint
    this.app.post('/send-message', this.authenticateApiKey.bind(this), async (req, res) => {
      try {
        const { phoneNumber, message } = req.body;

        // Validate input
        if (!phoneNumber || !message) {
          return res.status(400).json({
            error: 'Missing required fields',
            message: 'Both phoneNumber and message are required'
          });
        }

        // Check if WhatsApp client is ready
        if (!this.whatsappClient.isReady) {
          return res.status(503).json({
            error: 'WhatsApp client not ready',
            message: 'WhatsApp client is not connected or ready to send messages'
          });
        }

        // Send message
        const success = await this.whatsappClient.sendMessage(phoneNumber, message);
        
        if (success) {
          res.json({
            success: true,
            message: 'Message sent successfully',
            phoneNumber: phoneNumber,
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(500).json({
            error: 'Failed to send message',
            message: 'Message sending failed, check logs for details'
          });
        }

      } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message
        });
      }
    });

    // Send alert endpoint (convenience method)
    this.app.post('/send-alert', this.authenticateApiKey.bind(this), async (req, res) => {
      try {
        const { phoneNumber, deviceName, duration } = req.body;

        if (!phoneNumber || !deviceName || duration === undefined) {
          return res.status(400).json({
            error: 'Missing required fields',
            message: 'phoneNumber, deviceName, and duration are required'
          });
        }

        if (!this.whatsappClient.isReady) {
          return res.status(503).json({
            error: 'WhatsApp client not ready',
            message: 'WhatsApp client is not connected or ready to send messages'
          });
        }

        const success = await this.whatsappClient.sendDowntimeAlert(phoneNumber, deviceName, duration);
        
        if (success) {
          res.json({
            success: true,
            message: 'Alert sent successfully',
            phoneNumber: phoneNumber,
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(500).json({
            error: 'Failed to send alert',
            message: 'Alert sending failed, check logs for details'
          });
        }

      } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message
        });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: 'The requested endpoint does not exist'
      });
    });
  }

  start() {
    const port = this.config.api?.port || 3000;
    
    this.server = this.app.listen(port, () => {
      console.log(`🚀 API server running on port ${port}`);
      console.log(`📍 Health check: http://localhost:${port}/health`);
      console.log(`📱 Send message: POST http://localhost:${port}/send-message`);
      console.log(`🚨 Send alert: POST http://localhost:${port}/send-alert`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('📴 API server stopped');
      });
    }
  }
}

module.exports = ApiServer;