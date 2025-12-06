// Clear fake analytics data and regenerate with real asset names
const mongoose = require('mongoose');

// Connect to MongoDB with a different connection
mongoose.connect('mongodb://localhost:27017/amc_platform', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
});

// Import models
require('./models/AMCAnalytics');
require('./models/CenterRelease');

const AMCInteraction = mongoose.model('AMCInteraction');
const CenterRelease = mongoose.model('CenterRelease');

async function clearAndRegenerateAnalytics() {
    try {
        console.log('🗑️ Clearing existing fake analytics data...');
        
        // Clear all existing analytics data
        await AMCInteraction.deleteMany({});
        console.log('✅ Cleared all existing analytics data');
        
        console.log('📊 Fetching real releases and assets...');
        
        // Get real releases with assets
        const releases = await CenterRelease.find({ 
            status: 'published',
            assets: { $exists: true, $not: { $size: 0 } }
        }).lean();
        
        console.log(`📋 Found ${releases.length} real releases with assets`);
        
        if (releases.length === 0) {
            console.log('❌ No releases with assets found');
            process.exit(1);
        }
        
        // Collect all real assets with their actual filenames
        const realAssets = [];
        releases.forEach(release => {
            if (release.assets && release.assets.length > 0) {
                release.assets.forEach(asset => {
                    if (asset.filename || asset.originalName) {
                        realAssets.push({
                            filename: asset.filename || asset.originalName,
                            releaseTitle: release.title,
                            releaseId: release._id,
                            assetId: asset._id || new mongoose.Types.ObjectId(),
                            assetType: getAssetTypeFromFilename(asset.filename || asset.originalName)
                        });
                    }
                });
            }
        });
        
        console.log(`📁 Found ${realAssets.length} real assets with filenames`);
        
        if (realAssets.length === 0) {
            console.log('❌ No assets with filenames found');
            process.exit(1);
        }
        
        // Show some examples of real assets
        console.log('\n📋 Sample real assets found:');
        realAssets.slice(0, 5).forEach((asset, index) => {
            console.log(`  ${index + 1}. ${asset.filename} (${asset.assetType}) from "${asset.releaseTitle}"`);
        });
        
        console.log('\n🔄 Generating new analytics data with real assets...');
        
        // Sample users
        const sampleUsers = [
            { id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), email: 'j.smith@autoweekly.com' },
            { id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'), email: 'r.davis@motortrend.com' },
            { id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'), email: 'a.chen@techdrive.net' },
            { id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'), email: 'm.johnson@carnews.com' },
            { id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439015'), email: 's.williams@autojournal.com' }
        ];
        
        // Geographic regions
        const regions = [
            { region: 'North America', country: 'United States' },
            { region: 'North America', country: 'Canada' },
            { region: 'EMEA', country: 'Germany' },
            { region: 'EMEA', country: 'United Kingdom' },
            { region: 'APAC', country: 'Japan' },
            { region: 'APAC', country: 'Australia' }
        ];
        
        const interactions = [];
        
        // Generate realistic interactions using real assets
        for (let i = 0; i < 500; i++) {
            const user = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
            const geo = regions[Math.floor(Math.random() * regions.length)];
            const asset = realAssets[Math.floor(Math.random() * realAssets.length)];
            
            // Generate timestamp within last 30 days
            const now = new Date();
            const pastDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            const timestamp = new Date(pastDate.getTime() + Math.random() * (now.getTime() - pastDate.getTime()));
            
            const interaction = {
                userId: user.id,
                userEmail: user.email,
                releaseId: asset.releaseId,
                releaseTitle: asset.releaseTitle,
                assetId: asset.assetId,
                assetName: asset.filename,
                assetType: asset.assetType,
                interactionType: 'asset_download',
                timestamp: timestamp,
                region: geo.region,
                country: geo.country,
                sessionId: new mongoose.Types.ObjectId(),
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };
            
            interactions.push(interaction);
        }
        
        // Add some other interaction types
        for (let i = 0; i < 200; i++) {
            const user = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
            const geo = regions[Math.floor(Math.random() * regions.length)];
            const release = releases[Math.floor(Math.random() * releases.length)];
            
            const now = new Date();
            const pastDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            const timestamp = new Date(pastDate.getTime() + Math.random() * (now.getTime() - pastDate.getTime()));
            
            const interactionTypes = ['page_view', 'asset_quick_view', 'search_query'];
            const interactionType = interactionTypes[Math.floor(Math.random() * interactionTypes.length)];
            
            const interaction = {
                userId: user.id,
                userEmail: user.email,
                releaseId: release._id,
                releaseTitle: release.title,
                interactionType: interactionType,
                timestamp: timestamp,
                region: geo.region,
                country: geo.country,
                sessionId: new mongoose.Types.ObjectId(),
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };
            
            if (interactionType === 'search_query') {
                const searchTerms = ['BMW', 'Mercedes', 'Audi', 'electric', 'hybrid'];
                interaction.searchQuery = searchTerms[Math.floor(Math.random() * searchTerms.length)];
            }
            
            interactions.push(interaction);
        }
        
        console.log(`💾 Inserting ${interactions.length} new interactions with real asset names...`);
        
        // Insert all interactions
        await AMCInteraction.insertMany(interactions);
        
        console.log('✅ Successfully generated analytics data with real assets!');
        
        // Show summary
        const downloadCount = interactions.filter(i => i.interactionType === 'asset_download').length;
        const uniqueAssets = new Set(interactions.filter(i => i.assetName).map(i => i.assetName)).size;
        const uniqueReleases = new Set(interactions.map(i => i.releaseTitle)).size;
        
        console.log('\n📈 Analytics Summary:');
        console.log(`  📥 Total Downloads: ${downloadCount}`);
        console.log(`  📁 Unique Assets: ${uniqueAssets}`);
        console.log(`  📋 Unique Releases: ${uniqueReleases}`);
        console.log(`  🔄 Total Interactions: ${interactions.length}`);
        
        // Show some examples of real data
        const examples = interactions.filter(i => i.assetName).slice(0, 5);
        console.log('\n📋 Sample real analytics data:');
        examples.forEach((interaction, index) => {
            console.log(`  ${index + 1}. ${interaction.assetName} from "${interaction.releaseTitle}"`);
        });
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

function getAssetTypeFromFilename(filename) {
    if (!filename) return 'document';
    
    const ext = filename.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi', 'wmv', 'webm'].includes(ext)) return 'video';
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return 'document';
    return 'other';
}

// Run the script
clearAndRegenerateAnalytics();