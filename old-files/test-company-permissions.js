// Test script to create sample data for company-scoped permissions
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('./models/User');
const Client = require('./models/Client');
const UserCompanyPermissions = require('./models/UserCompanyPermissions');

async function setupTestData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing test data
        console.log('🧹 Cleaning up existing test data...');
        await UserCompanyPermissions.deleteMany({});
        await User.deleteMany({
            email: {
                $in: [
                    'joe.bloggs@mercedes.com',
                    'martha.doe@mercedes.com',
                    'admin@automediacenter.com',
                    'test.user@bmw.com'
                ]
            }
        });
        await Client.deleteMany({ clientName: { $in: ['Mercedes-Benz', 'BMW Group', 'Audi AG'] } });

        // Create sample clients
        console.log('🏢 Creating sample clients...');
        const mercedesClient = await Client.create({
            clientName: 'Mercedes-Benz',
            contactPerson: 'Martha Doe',
            contactEmail: 'martha.doe@mercedes.com'
        });

        const bmwClient = await Client.create({
            clientName: 'BMW Group',
            contactPerson: 'Hans Mueller',
            contactEmail: 'hans.mueller@bmw.com'
        });

        const audiClient = await Client.create({
            clientName: 'Audi AG',
            contactPerson: 'Anna Schmidt',
            contactEmail: 'anna.schmidt@audi.com'
        });

        console.log('✅ Created clients:', {
            mercedes: mercedesClient._id,
            bmw: bmwClient._id,
            audi: audiClient._id
        });

        // Create sample users
        console.log('👥 Creating sample users...');
        
        // Joe - Media User (can only view content)
        const joeUser = await User.create({
            email: 'joe.bloggs@mercedes.com',
            password: 'password123',
            name: 'Joe Bloggs',
            role: 'media_user'
            // No clientId for media users
        });

        // Martha - Client Admin for Mercedes
        const marthaUser = await User.create({
            email: 'martha.doe@mercedes.com',
            password: 'password123',
            name: 'Martha Doe',
            role: 'client_admin',
            clientId: mercedesClient._id
        });

        // Platform Admin
        const adminUser = await User.create({
            email: 'admin@automediacenter.com',
            password: 'admin123',
            name: 'Platform Administrator',
            role: 'platform_admin'
            // No clientId for platform admins
        });

        console.log('✅ Created users:', {
            joe: joeUser._id,
            martha: marthaUser._id,
            admin: adminUser._id
        });

        // Create company permissions for Martha
        console.log('🔐 Setting up company permissions...');
        
        const marthaPermissions = await UserCompanyPermissions.create({
            userId: marthaUser._id,
            clientId: mercedesClient._id,
            role: 'client_admin',
            assignedBy: adminUser._id
            // Permissions will be set automatically by pre-save middleware
        });

        console.log('✅ Created permissions for Martha:', marthaPermissions);

        // Test scenario: Create a client_user for BMW to show multi-company support
        const bmwUser = await User.create({
            email: 'test.user@bmw.com',
            password: 'password123',
            name: 'BMW Test User',
            role: 'client_user',
            clientId: bmwClient._id
        });

        const bmwPermissions = await UserCompanyPermissions.create({
            userId: bmwUser._id,
            clientId: bmwClient._id,
            role: 'client_user',
            assignedBy: adminUser._id
        });

        console.log('✅ Created BMW test user and permissions');

        // Display test credentials
        console.log('\n🎯 TEST CREDENTIALS CREATED:');
        console.log('================================');
        console.log('1. MEDIA USER (Joe - can only view content):');
        console.log('   Email: joe.bloggs@mercedes.com');
        console.log('   Password: password123');
        console.log('   Role: media_user');
        console.log('   Access: Can view/download content, NO upload access');
        console.log('');
        console.log('2. CLIENT ADMIN (Martha - can upload for Mercedes):');
        console.log('   Email: martha.doe@mercedes.com');
        console.log('   Password: password123');
        console.log('   Role: client_admin');
        console.log('   Access: Can upload/manage Mercedes content, view analytics');
        console.log('');
        console.log('3. PLATFORM ADMIN (Full system control):');
        console.log('   Email: admin@automediacenter.com');
        console.log('   Password: admin123');
        console.log('   Role: platform_admin');
        console.log('   Access: Full system control, user management, all companies');
        console.log('');
        console.log('4. BMW CLIENT USER (Test multi-company):');
        console.log('   Email: test.user@bmw.com');
        console.log('   Password: password123');
        console.log('   Role: client_user');
        console.log('   Access: Can upload BMW content only');
        console.log('');
        console.log('🧪 TEST SCENARIOS:');
        console.log('- Joe should NOT see upload dashboard');
        console.log('- Martha should see upload dashboard for Mercedes only');
        console.log('- Admin should see admin dashboard and manage all users');
        console.log('- BMW user should see upload dashboard for BMW only');
        console.log('');
        console.log('🌐 TEST URLS:');
        console.log('- Login: http://localhost:5000/login-test.html');
        console.log('- Welcome: http://localhost:5000/welcome-modal.html');
        console.log('- Admin Dashboard: http://localhost:5000/admin-dashboard.html');
        console.log('- Upload Dashboard: http://localhost:5000/AssetDBmenu1.6.html');

        console.log('\n✅ Test data setup complete!');

    } catch (error) {
        console.error('❌ Error setting up test data:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the setup
setupTestData();