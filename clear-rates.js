const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('✅ Connected to MongoDB');
  
  const rateLimitCollection = mongoose.connection.db.collection('rateLimitStore');
  const result = await rateLimitCollection.deleteMany({});
  console.log(`✅ Cleared ${result.deletedCount} rate limit entries`);
  
  console.log('🎉 Rate limits cleared! You can now log in immediately.');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});