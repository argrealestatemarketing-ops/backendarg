const { MongoClient } = require('mongodb');

async function cleanMongoDuplicates() {
  try {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('hr_attendance');
    const users = db.collection('users');
    
    // Find all users with leading zeros (old format)
    const oldFormatUsers = await users.find({
      employeeId: { '$regex': '^0+' }
    }).toArray();
    
    console.log('Found ' + oldFormatUsers.length + ' users with leading zeros:');
    oldFormatUsers.forEach(user => {
      console.log('- ID: ' + user.employeeId + ', Name: ' + user.name);
    });
    
    if (oldFormatUsers.length > 0) {
      // Delete the old format users
      const deleteResult = await users.deleteMany({
        employeeId: { '$regex': '^0+' }
      });
      
      console.log('Deleted ' + deleteResult.deletedCount + ' old format users');
      
      // Verify remaining users
      const remainingUsers = await users.find({}).toArray();
      console.log('Remaining users count: ' + remainingUsers.length);
      
      // Show sample of remaining users
      const sample = remainingUsers.slice(0, 10);
      console.log('Sample of remaining users:');
      sample.forEach((user, index) => {
        console.log((index + 1) + '. ID: ' + user.employeeId + ', Name: ' + user.name);
      });
    } else {
      console.log('No old format users found to delete');
    }
    
    await client.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

cleanMongoDuplicates();