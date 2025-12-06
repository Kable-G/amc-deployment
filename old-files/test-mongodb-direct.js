const mongoose = require('mongoose');
require('dotenv').config();

async function testMongoDB() {
    try {
        console.log('🔌 Testing direct MongoDB connection...');
        console.log('Connection string:', process.env.MONGO_URI.replace(/:[^:@]*@/, ':***@'));
        
        // Set connection options
        const options = {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 1,
            bufferCommands: false
        };
        
        await mongoose.connect(process.env.MONGO_URI, options);
        console.log('✅ MongoDB Connected successfully!');
        
        // Test a simple query
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('📊 Available collections:', collections.map(c => c.name));
        
        // Test users collection specifically
        const usersCount = await mongoose.connection.db.collection('users').countDocuments();
        console.log('👥 Users in database:', usersCount);
        
        // Try to find the admin user
        const adminUser = await mongoose.connection.db.collection('users').findOne({ 
            email: 'admin@automediacenter.com' 
        });
        
        if (adminUser) {
            console.log('✅ Admin user found:', {
                email: adminUser.email,
                name: adminUser.name,
                role: adminUser.role
            });
        } else {
            console.log('❌ Admin user not found');
        }
        
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        
        if (error.cause) {
            console.error('Error cause:', error.cause);
        }
        
        process.exit(1);
    }
}

testMongoDB();