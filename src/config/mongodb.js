const mongoose = require('mongoose');
const { auditLogger } = require('../utils/logger'); // Import the logger

class MongoDBConnection {
  constructor() {
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 5000; // 5 seconds
  }

  async connect() {
    try {
      const uri = process.env.MONGODB_URI || 'mongodb+srv://Elbik:Elbik010@arg.upi9rpg.mongodb.net/hr_attendance?retryWrites=true&w=majority&appName=ARG';
      
      // Set up mongoose connection options for MongoDB Atlas
      const options = {
        serverSelectionTimeoutMS: 30000, // Increase timeout for Atlas connection
        bufferCommands: false, // Disable mongoose buffering
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        connectTimeoutMS: 30000, // Increase connection timeout for Atlas
        maxPoolSize: 10, // Maintain up to 10 socket connections
      };

      // Connect using mongoose
      await mongoose.connect(uri, options);
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      auditLogger.info('MongoDB connected successfully', {
        database: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        timestamp: new Date().toISOString()
      });
      
      // Handle disconnection events with retry logic
      mongoose.connection.on('disconnected', () => {
        auditLogger.warn('MongoDB disconnected', {
          timestamp: new Date().toISOString()
        });
        this.isConnected = false;
        this.handleReconnect();
      });

      mongoose.connection.on('error', (err) => {
        auditLogger.error('MongoDB connection error:', {
          error: err.message,
          name: err.name,
          timestamp: new Date().toISOString()
        });
        if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
          this.isConnected = false;
          this.handleReconnect();
        }
      });

      mongoose.connection.on('reconnected', () => {
        auditLogger.info('MongoDB reconnected successfully', {
          timestamp: new Date().toISOString()
        });
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      return mongoose.connection;
      
    } catch (error) {
      auditLogger.error('MongoDB connection failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      this.isConnected = false;
      throw error;
    }
  }

  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      auditLogger.error('Maximum reconnection attempts reached. Stopping reconnection attempts.', {
        attempts: this.reconnectAttempts,
        timestamp: new Date().toISOString()
      });
      return;
    }

    this.reconnectAttempts++;
    auditLogger.warn(`Attempting to reconnect to MongoDB (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`, {
      attempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      timestamp: new Date().toISOString()
    });
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        auditLogger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, {
          error: error.message,
          attempts: this.reconnectAttempts,
          timestamp: new Date().toISOString()
        });
        this.handleReconnect(); // Try again
      }
    }, this.reconnectInterval);
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      auditLogger.info('MongoDB disconnected', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      auditLogger.error('Error disconnecting from MongoDB:', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  getDb() {
    if (!this.isConnected) {
      throw new Error('MongoDB is not connected. Call connect() first.');
    }
    return mongoose.connection;
  }

  isConnectedToMongoDB() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  // Helper methods for common operations using Mongoose models
  async insertOne(model, document) {
    try {
      const result = await model.create(document);
      return result;
    } catch (error) {
      auditLogger.error(`Error inserting document into ${model.modelName}:`, {
        error: error.message,
        modelName: model.modelName,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async find(model, query = {}, options = {}) {
    try {
      return await model.find(query, null, options);
    } catch (error) {
      auditLogger.error(`Error finding documents in ${model.modelName}:`, {
        error: error.message,
        modelName: model.modelName,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async findOne(model, query = {}) {
    try {
      return await model.findOne(query);
    } catch (error) {
      auditLogger.error(`Error finding document in ${model.modelName}:`, {
        error: error.message,
        modelName: model.modelName,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async updateOne(model, filter, update) {
    try {
      return await model.updateOne(filter, update);
    } catch (error) {
      auditLogger.error(`Error updating document in ${model.modelName}:`, {
        error: error.message,
        modelName: model.modelName,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async deleteOne(model, filter) {
    try {
      return await model.deleteOne(filter);
    } catch (error) {
      auditLogger.error(`Error deleting document from ${model.modelName}:`, {
        error: error.message,
        modelName: model.modelName,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new MongoDBConnection();