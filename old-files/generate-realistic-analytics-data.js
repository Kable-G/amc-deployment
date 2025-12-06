// Generate realistic analytics data based on actual releases and assets
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');

// Import models
require('./models/CenterRelease');
require('./models/AMCAnalytics');

const CenterRelease = mongoose.model('CenterRelease');
const AMCInteraction = mongoose.model('AMCInteraction');
const MediaPickup = mongoose.model('MediaPickup');
const UserSession = mongoose.model('UserSession');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/amc_platform', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Sample users for analytics
const sampleUsers = [
    { id: new ObjectId('507f1f77bcf86cd799439011'), email: 'j.smith@autoweekly.com', name: 'John Smith' },
    { id: new ObjectId('507f1f77bcf86cd799439012'), email: 'r.davis@motortrend.com', name: 'Rachel Davis' },
    { id: new ObjectId('507f1f77bcf86cd799439013'), email: 'a.chen@techdrive.net', name: 'Alex Chen' },
    { id: new ObjectId('507f1f77bcf86cd799439014'), email: 'm.johnson@carnews.com', name: 'Mike Johnson' },
    { id: new ObjectId('507f1f77bcf86cd799439015'), email: 's.williams@autojournal.com', name: 'Sarah Williams' }
];

// Geographic regions
const regions = [
    { region: 'North America', country: 'United States' },
    { region: 'North America', country: 'Canada' },
    { region: 'EMEA', country: 'Germany' },
    { region: 'EMEA', country: 'United Kingdom' },
    { region: 'EMEA', country: 'France' },
    { region: 'APAC', country: 'Japan' },
    { region: 'APAC', country: 'Australia' },
    { region: 'South America', country: 'Brazil' }
];

// Interaction types
const interactionTypes = [
    'asset_download',
    'page_view', 
    'asset_quick_view',
    'search_query',
    'filter_applied',
    'pagination'
];

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomDate(daysBack = 30) {
    const now = new Date();
    const pastDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    return new Date(pastDate.getTime() + Math.random() * (now.getTime() - pastDate.getTime()));
}

function getAssetTypeFromFilename(filename) {
    if (!filename) return 'document';
    
    const ext = filename.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi', 'wmv', 'webm'].includes(ext)) return 'video';
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return 'document';
    return 'other';
}

async function generateRealisticAnalyticsData() {
    try {
        console.log('🔄 Fetching real releases from database...');
        
        // Get real releases with assets
        const releases = await CenterRelease.find({ 
            status: 'published',
            assets: { $exists: true, $not: { $size: 0 } }
        }).limit(20).lean();
        
        console.log(`📊 Found ${releases.length} releases with assets`);
        
        if (releases.length === 0) {
            console.log('❌ No releases with assets found. Cannot generate realistic data.');
            return;
        }
        
        // Clear existing analytics data
        console.log('🗑️ Clearing existing analytics data...');
        await AMCInteraction.deleteMany({});
        await MediaPickup.deleteMany({});
        await UserSession.deleteMany({});
        
        const interactions = [];
        const mediaPickups = [];
        const userSessions = [];
        
        console.log('📈 Generating realistic analytics data...');
        
        // Generate interactions for each release
        for (const release of releases) {
            const releaseInteractionCount = Math.floor(Math.random() * 50) + 10; // 10-60 interactions per release
            
            console.log(`  📋 Processing "${release.title}" (${release.assets.length} assets)`);
            
            for (let i = 0; i < releaseInteractionCount; i++) {
                const user = getRandomElement(sampleUsers);
                const geo = getRandomElement(regions);
                const timestamp = getRandomDate(30);
                const interactionType = getRandomElement(interactionTypes);
                
                let interaction = {
                    userId: user.id,
                    userEmail: user.email,
                    releaseId: release._id,
                    releaseTitle: release.title,
                    interactionType: interactionType,
                    timestamp: timestamp,
                    region: geo.region,
                    country: geo.country,
                    sessionId: new ObjectId(),
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                };
                
                // For asset downloads, pick a real asset
                if (interactionType === 'asset_download' && release.assets.length > 0) {
                    const asset = getRandomElement(release.assets);
                    interaction.assetName = asset.filename || asset.originalName || `asset_${Math.random().toString(36).substr(2, 9)}.jpg`;
                    interaction.assetType = getAssetTypeFromFilename(interaction.assetName);
                    interaction.assetId = asset._id || new ObjectId();
                }
                
                // For search queries, add search terms
                if (interactionType === 'search_query') {
                    const searchTerms = ['BMW', 'Mercedes', 'Audi', 'electric', 'hybrid', 'concept', 'launch', 'reveal'];
                    interaction.searchQuery = getRandomElement(searchTerms);
                }
                
                interactions.push(interaction);
            }
            
            // Generate some media pickups for popular releases
            if (Math.random() > 0.7) { // 30% chance of media pickup
                const pickupCount = Math.floor(Math.random() * 3) + 1;
                for (let j = 0; j < pickupCount; j++) {
                    mediaPickups.push({
                        releaseId: release._id,
                        releaseTitle: release.title,
                        detectedAt: getRandomDate(15),
                        sourceUrl: `https://example-news-site-${Math.floor(Math.random() * 10)}.com/article/${Math.random().toString(36).substr(2, 9)}`,
                        sourceDomain: `news-site-${Math.floor(Math.random() * 10)}.com`,
                        articleTitle: `${release.title} - Industry Analysis`,
                        confidence: 0.8 + Math.random() * 0.2
                    });
                }
            }
        }
        
        // Generate user sessions
        console.log('👥 Generating user sessions...');
        for (const user of sampleUsers) {
            const sessionCount = Math.floor(Math.random() * 20) + 5; // 5-25 sessions per user
            for (let i = 0; i < sessionCount; i++) {
                const geo = getRandomElement(regions);
                userSessions.push({
                    userId: user.id,
                    userEmail: user.email,
                    sessionStart: getRandomDate(30),
                    sessionEnd: new Date(Date.now() + Math.random() * 3600000), // Up to 1 hour session
                    region: geo.region,
                    country: geo.country,
                    pagesViewed: Math.floor(Math.random() * 10) + 1,
                    assetsDownloaded: Math.floor(Math.random() * 5),
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                });
            }
        }
        
        // Insert all data
        console.log('💾 Inserting analytics data...');
        console.log(`  📊 ${interactions.length} interactions`);
        console.log(`  📰 ${mediaPickups.length} media pickups`);
        console.log(`  👤 ${userSessions.length} user sessions`);
        
        if (interactions.length > 0) {
            await AMCInteraction.insertMany(interactions);
        }
        if (mediaPickups.length > 0) {
            await MediaPickup.insertMany(mediaPickups);
        }
        if (userSessions.length > 0) {
            await UserSession.insertMany(userSessions);
        }
        
        console.log('✅ Realistic analytics data generated successfully!');
        
        // Show summary
        const totalDownloads = interactions.filter(i => i.interactionType === 'asset_download').length;
        const uniqueUsers = new Set(interactions.map(i => i.userId.toString())).size;
        const uniqueReleases = new Set(interactions.map(i => i.releaseId.toString())).size;
        
        console.log('\n📈 Analytics Summary:');
        console.log(`  📥 Total Downloads: ${totalDownloads}`);
        console.log(`  👥 Unique Users: ${uniqueUsers}`);
        console.log(`  📋 Releases with Activity: ${uniqueReleases}`);
        console.log(`  📰 Media Pickups: ${mediaPickups.length}`);
        console.log(`  🔄 Total Interactions: ${interactions.length}`);
        
    } catch (error) {
        console.error('❌ Error generating analytics data:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the script
generateRealisticAnalyticsData();