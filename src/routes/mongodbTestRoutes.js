const express = require('express');
const router = express.Router();
const mongoDB = require('../config/mongodb');

// Test MongoDB connection
router.get('/test-connection', async (req, res) => {
  try {
    if (!mongoDB.isConnected) {
      return res.status(503).json({
        success: false,
        error: 'MongoDB is not connected'
      });
    }

    const db = mongoDB.getDb();
    const collections = await db.listCollections().toArray();
    
    res.status(200).json({
      success: true,
      message: 'MongoDB connection successful',
      database: db.databaseName,
      collections: collections.map(c => c.name),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to test MongoDB connection',
      details: error.message
    });
  }
});

// Insert test document
router.post('/test-insert', async (req, res) => {
  try {
    if (!mongoDB.isConnected) {
      return res.status(503).json({
        success: false,
        error: 'MongoDB is not connected'
      });
    }

    const testDoc = {
      name: 'Test Document',
      createdAt: new Date(),
      test: true
    };

    const result = await mongoDB.insertOne('test_collection', testDoc);
    
    res.status(201).json({
      success: true,
      message: 'Document inserted successfully',
      insertedId: result.insertedId,
      document: testDoc
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to insert document',
      details: error.message
    });
  }
});

// Get all test documents
router.get('/test-documents', async (req, res) => {
  try {
    if (!mongoDB.isConnected) {
      return res.status(503).json({
        success: false,
        error: 'MongoDB is not connected'
      });
    }

    const documents = await mongoDB.find('test_collection');
    
    res.status(200).json({
      success: true,
      count: documents.length,
      documents: documents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve documents',
      details: error.message
    });
  }
});

module.exports = router;