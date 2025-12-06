const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Clear rate limiting data
const clearRateLimits = async () => {
  try {
    // Clear the rate limit store collection
    const rateLimitCollection = mongoose.connection.db.collection('rateLimitStore');
    const result = await rateLimitCollection.deleteMany({});
    console.log(`✅ Cleared ${result.deletedCount} rate limit entries`);
    
    // Also clear any audit events related to rate limiting
    const AuditEvent = require('./models/AuditEvent');
    const auditResult = await AuditEvent.deleteMany({
      action: { $regex: /^security\.rate_limit/ }
    });
    console.log(`✅ Cleared ${auditResult.deletedCount} rate limit audit events`);
    
    console.log('🎉 Rate limits cleared! You can now log in immediately.');
    console.log('📝 Note: Rate limiting is still active for future attempts - this just resets your current "strike count"');
    
  } catch (error) {
    console.error('❌ Error clearing rate limits:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
    process.exit(0);
  }
};

// Run the script
const main = async () => {
  console.log('🔧 Clearing rate limits for immediate login access...');
  await connectDB();
  await clearRateLimits();
};

main();