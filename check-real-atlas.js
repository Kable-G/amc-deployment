const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkRealAtlas() {
    console.log('🔍 Checking your actual MongoDB Atlas database...');
    
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
        console.error('❌ MONGO_URI not found in .env file');
        return;
    }
    
    console.log('🔗 Connection string found in .env');
    
    try {
        const client = new MongoClient(mongoURI);
        await client.connect();
        console.log('✅ Connected to MongoDB Atlas successfully!');
        
        // List all databases
        const adminDb = client.db().admin();
        const databases = await adminDb.listDatabases();
        console.log('\n📊 Available databases:');
        databases.databases.forEach(db => {
            console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
        });
        
        // Check both 'test' and 'automediacenter' databases
        const dbsToCheck = ['test', 'automediacenter'];
        
        for (const dbName of dbsToCheck) {
            console.log(`\n🔍 Checking database: ${dbName}`);
            const db = client.db(dbName);
            
            try {
                const collections = await db.listCollections().toArray();
                
                if (collections.length === 0) {
                    console.log(`  ❌ No collections found in ${dbName}`);
                    continue;
                }
                
                console.log(`  📁 Collections in ${dbName}:`);
                for (const collection of collections) {
                    const count = await db.collection(collection.name).countDocuments();
                    console.log(`    - ${collection.name}: ${count} documents`);
                }
                
                // Check for users specifically
                if (collections.some(c => c.name === 'users')) {
                    const users = await db.collection('users').find({}).toArray();
                    console.log(`\n  👥 Users in ${dbName}:`);
                    if (users.length === 0) {
                        console.log('    ❌ No users found!');
                    } else {
                        users.forEach(user => {
                            console.log(`    - ${user.email || user.username} (${user.role || 'no role'})`);
                        });
                    }
                }
            } catch (err) {
                console.log(`  ❌ Error checking ${dbName}: ${err.message}`);
            }
        }
        
        await client.close();
        
    } catch (error) {
        console.error('❌ Atlas connection failed:', error.message);
    }
}

checkRealAtlas();