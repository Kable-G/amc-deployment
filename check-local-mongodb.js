const { MongoClient } = require('mongodb');

async function checkLocalMongoDB() {
    console.log('🔍 Checking local MongoDB...');
    
    try {
        // Connect to local MongoDB
        const client = new MongoClient('mongodb://localhost:27017');
        await client.connect();
        console.log('✅ Connected to local MongoDB');
        
        // Check automediacenter database
        const db = client.db('automediacenter');
        const collections = await db.listCollections().toArray();
        
        console.log('\n📊 Collections in automediacenter database:');
        for (const collection of collections) {
            const count = await db.collection(collection.name).countDocuments();
            console.log(`  - ${collection.name}: ${count} documents`);
        }
        
        // Check for users specifically
        const users = await db.collection('users').find({}).toArray();
        console.log('\n👥 Users found:');
        users.forEach(user => {
            console.log(`  - ${user.email || user.username} (${user.role || 'no role'})`);
        });
        
        await client.close();
        
    } catch (error) {
        console.error('❌ Local MongoDB check failed:', error.message);
    }
}

checkLocalMongoDB();