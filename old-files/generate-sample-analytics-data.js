// generate-sample-analytics-data.js - Generate sample analytics data for testing

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { AMCInteraction, MediaPickup, UserSession } = require('./models/AMCAnalytics');

dotenv.config();

// Sample data generators
const sampleUsers = [
    { id: '507f1f77bcf86cd799439011', email: 'j.smith@autoweekly.com' },
    { id: '507f1f77bcf86cd799439012', email: 'r.davis@motortrend.com' },
    { id: '507f1f77bcf86cd799439013', email: 'a.chen@techdrive.net' },
    { id: '507f1f77bcf86cd799439014', email: 'm.johnson@carbuzz.com' },
    { id: '507f1f77bcf86cd799439015', email: 's.williams@autoexpress.co.uk' }
];

const sampleReleases = [
    { id: '507f1f77bcf86cd799439021', uuid: 'release-001', title: 'Global Reveal of the "Electron" Concept' },
    { id: '507f1f77bcf86cd799439022', uuid: 'release-002', title: 'New V8 Engine Technical Specs Released' },
    { id: '507f1f77bcf86cd799439023', uuid: 'release-003', title: 'Q3 Financial Results & Outlook' },
    { id: '507f1f77bcf86cd799439024', uuid: 'release-004', title: 'Partnership with AI Driving Systems' },
    { id: '507f1f77bcf86cd799439025', uuid: 'release-005', title: 'Classic "Legend" Model Restoration Photos' }
];

const sampleAssets = [
    { name: 'hero_image_01.jpg', type: 'image', size: 4200000 },
    { name: 'B-Roll_final.mp4', type: 'video', size: 125000000 },
    { name: 'specs.pdf', type: 'document', size: 2100000 },
    { name: 'ceo_portrait_highres.png', type: 'image', size: 8500000 },
    { name: 'interview_audio.mp3', type: 'audio', size: 15000000 },
    { name: 'technical_drawings.pdf', type: 'document', size: 3200000 },
    { name: 'product_showcase.mp4', type: 'video', size: 89000000 },
    { name: 'press_kit_images.zip', type: 'other', size: 45000000 }
];

const regions = ['North America', 'EMEA', 'APAC', 'South America'];
const countries = ['United States', 'United Kingdom', 'Germany', 'Japan', 'Australia', 'Brazil', 'Canada', 'France'];

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomDate(daysBack) {
    const now = new Date();
    const pastDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    const randomTime = pastDate.getTime() + Math.random() * (now.getTime() - pastDate.getTime());
    return new Date(randomTime);
}

function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function generateInteractions(count = 1000) {
    console.log(`Generating ${count} sample interactions...`);
    
    const interactions = [];
    const sessions = new Set();
    
    for (let i = 0; i < count; i++) {
        const user = getRandomElement(sampleUsers);
        const release = getRandomElement(sampleReleases);
        const asset = getRandomElement(sampleAssets);
        const sessionId = Math.random() < 0.3 ? generateSessionId() : Array.from(sessions)[Math.floor(Math.random() * sessions.size)] || generateSessionId();
        sessions.add(sessionId);
        
        const interactionTypes = [
            'page_view',
            'release_view', 
            'asset_download',
            'asset_quick_view',
            'asset_add_to_cart',
            'search_query'
        ];
        
        // Weight downloads and views more heavily
        const weightedTypes = [
            ...Array(20).fill('asset_download'),
            ...Array(15).fill('page_view'),
            ...Array(10).fill('release_view'),
            ...Array(8).fill('asset_quick_view'),
            ...Array(5).fill('asset_add_to_cart'),
            ...Array(3).fill('search_query')
        ];
        
        const interactionType = getRandomElement(weightedTypes);
        const timestamp = getRandomDate(30); // Last 30 days
        
        const interaction = {
            userId: user.id,
            userEmail: user.email,
            sessionId: sessionId,
            interactionType: interactionType,
            releaseId: release.id,
            releaseUuid: release.uuid,
            releaseTitle: release.title,
            timestamp: timestamp,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
            country: getRandomElement(countries),
            region: getRandomElement(regions),
            metadata: {
                clientId: '507f1f77bcf86cd799439012',
                userRole: 'client_user'
            }
        };
        
        // Add specific data based on interaction type
        if (interactionType === 'asset_download' || interactionType === 'asset_quick_view') {
            interaction.assetName = asset.name;
            interaction.assetType = asset.type;
            interaction.assetPath = `/uploads/center_releases/${asset.name}`;
            interaction.assetSize = asset.size;
        }
        
        if (interactionType === 'search_query') {
            const searchTerms = ['BMW', 'electric', 'concept', 'engine', 'specs', 'financial', 'partnership'];
            interaction.searchQuery = getRandomElement(searchTerms);
        }
        
        interactions.push(interaction);
    }
    
    try {
        await AMCInteraction.insertMany(interactions);
        console.log(`✅ Successfully generated ${interactions.length} interactions`);
    } catch (error) {
        console.error('❌ Error generating interactions:', error);
    }
}

async function generateMediaPickups(count = 50) {
    console.log(`Generating ${count} sample media pickups...`);
    
    const pickups = [];
    const outlets = [
        { name: 'AutoWeekly', type: 'magazine', domain: 'autoweekly.com' },
        { name: 'MotorTrend', type: 'magazine', domain: 'motortrend.com' },
        { name: 'Tech Drive', type: 'blog', domain: 'techdrive.net' },
        { name: 'Car Buzz', type: 'blog', domain: 'carbuzz.com' },
        { name: 'Auto Express', type: 'newspaper', domain: 'autoexpress.co.uk' },
        { name: 'Top Gear', type: 'tv', domain: 'topgear.com' },
        { name: 'Automotive News', type: 'newspaper', domain: 'autonews.com' }
    ];
    
    for (let i = 0; i < count; i++) {
        const release = getRandomElement(sampleReleases);
        const asset = getRandomElement(sampleAssets);
        const outlet = getRandomElement(outlets);
        
        const pickup = {
            releaseId: release.id,
            releaseUuid: release.uuid,
            releaseTitle: release.title,
            assetName: asset.name,
            assetType: asset.type,
            originalAssetPath: `/uploads/center_releases/${asset.name}`,
            sourceUrl: `https://${outlet.domain}/article/${Math.random().toString(36).substr(2, 9)}`,
            sourceDomain: outlet.domain,
            sourceTitle: `${release.title} - ${outlet.name} Coverage`,
            outletName: outlet.name,
            outletType: outlet.type,
            outletCountry: getRandomElement(countries),
            outletRegion: getRandomElement(regions),
            articleTitle: `Breaking: ${release.title}`,
            articleUrl: `https://${outlet.domain}/breaking-news/${Math.random().toString(36).substr(2, 9)}`,
            publishedDate: getRandomDate(7), // Last 7 days
            detectedAt: getRandomDate(5), // Last 5 days
            detectionMethod: 'crawler',
            confidence: 0.8 + Math.random() * 0.2, // 0.8 to 1.0
            status: 'verified'
        };
        
        pickups.push(pickup);
    }
    
    try {
        await MediaPickup.insertMany(pickups);
        console.log(`✅ Successfully generated ${pickups.length} media pickups`);
    } catch (error) {
        console.error('❌ Error generating media pickups:', error);
    }
}

async function generateUserSessions(count = 200) {
    console.log(`Generating ${count} sample user sessions...`);
    
    const sessions = [];
    
    for (let i = 0; i < count; i++) {
        const user = getRandomElement(sampleUsers);
        const startTime = getRandomDate(30);
        const duration = Math.floor(Math.random() * 3600) + 60; // 1 minute to 1 hour
        const endTime = new Date(startTime.getTime() + duration * 1000);
        
        const session = {
            sessionId: generateSessionId(),
            userId: user.id,
            userEmail: user.email,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            pageViews: Math.floor(Math.random() * 20) + 1,
            downloads: Math.floor(Math.random() * 10),
            quickViews: Math.floor(Math.random() * 15),
            searches: Math.floor(Math.random() * 5),
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
            country: getRandomElement(countries),
            region: getRandomElement(regions),
            isActive: Math.random() < 0.1 // 10% still active
        };
        
        sessions.push(session);
    }
    
    try {
        await UserSession.insertMany(sessions);
        console.log(`✅ Successfully generated ${sessions.length} user sessions`);
    } catch (error) {
        console.error('❌ Error generating user sessions:', error);
    }
}

async function main() {
    try {
        console.log('🚀 Starting sample analytics data generation...');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
        
        // Clear existing analytics data
        console.log('🧹 Clearing existing analytics data...');
        await AMCInteraction.deleteMany({});
        await MediaPickup.deleteMany({});
        await UserSession.deleteMany({});
        
        // Generate sample data
        await generateInteractions(2000);
        await generateMediaPickups(100);
        await generateUserSessions(300);
        
        console.log('🎉 Sample analytics data generation completed!');
        console.log('\nGenerated:');
        console.log('- 2000 user interactions');
        console.log('- 100 media pickups');
        console.log('- 300 user sessions');
        console.log('\nYou can now test the analytics dashboard at: http://localhost:5000/amc-analytics.html');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    generateInteractions,
    generateMediaPickups,
    generateUserSessions
};