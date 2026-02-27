const { MongoClient } = require('mongodb');

async function checkAtlasMongoDB() {
    console.log('🔍 Checking MongoDB Atlas database...');
    
    // We need to get the actual connection string from your server
    // Let's try the most common Atlas connection patterns
    const possibleConnections = [
        'mongodb://localhost:27017/automediacenter', // This might actually be Atlas
        process.env.MONGODB_URI,
        process.env.DATABASE_URL,
        process.env.MONGO_URI
    ];
    
    for (const connectionString of possibleConnections) {
        if (!connectionString) continue;
        
        try {
            console.log(`\n🔗 Trying connection: ${connectionString.replace(/\/\/.*@/, '//***@')}`);
            
            const client = new MongoClient(connectionString);
            await client.connect();
            console.log('✅ Connected successfully!');
            
            const db = client.db('automediacenter');
            const collections = await db.listCollections().toArray();
            
            console.log('\n📊 Collections found:');
            for (const collection of collections) {
                const count = await db.collection(collection.name).countDocuments();
                console.log(`  - ${collection.name}: ${count} documents`);
            }
            
            // Check for users specifically
            try {
                const users = await db.collection('users').find({}).toArray();
                console.log('\n👥 Users found:');
                if (users.length === 0) {
                    console.log('  ❌ No users found in database!');
                } else {
                    users.forEach(user => {
                        console.log(`  - ${user.email || user.username} (${user.role || 'no role'})`);
                    });
                }
            } catch (err) {
                console.log('  ❌ No users collection found');
            }
            
            await client.close();
            break;
            
        } catch (error) {
            console.log(`❌ Connection failed: ${error.message}`);
        }
    }
}

checkAtlasMongoDB();