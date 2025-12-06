const fs = require('fs');
const path = require('path');

async function disableDuplicateEndpoints() {
    console.log('🔧 Disabling duplicate asset_download tracking in analytics endpoints...');
    
    const filePath = path.join(__dirname, 'routes', 'amcAnalytics.routes.js');
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let changes = 0;
        
        // Find and disable asset_download in all three locations
        
        // 1. Disable in /track endpoint (around line 124)
        const trackPattern = /(\/\/ Create interaction record\s*\n\s*const interaction = new AMCInteraction\(\{)/;
        if (trackPattern.test(content)) {
            content = content.replace(trackPattern, `
        // Skip asset_download - handled by universalDownloadTracker middleware
        if (interactionType === 'asset_download') {
            return res.status(200).json({ 
                success: true, 
                message: 'Download tracking handled by middleware',
                skipped: true 
            });
        }

        // Create interaction record
        const interaction = new AMCInteraction({`);
            changes++;
            console.log('✅ Fixed /track endpoint');
        }
        
        // 2. Disable in /track-batch endpoint (around line 850)
        const batchPattern = /(\/\/ Create interaction record\s*\n\s*const interaction = new AMCInteraction\(\{\s*userId: req\.user\.id,)/;
        if (batchPattern.test(content)) {
            content = content.replace(batchPattern, `
            // Skip asset_download - handled by universalDownloadTracker middleware
            if (interactionType === 'asset_download') {
                continue; // Skip this interaction in batch
            }

            // Create interaction record
            const interaction = new AMCInteraction({
                userId: req.user.id,`);
            changes++;
            console.log('✅ Fixed /track-batch endpoint');
        }
        
        // 3. Disable in /sync-download-events endpoint (around line 1072)
        const syncPattern = /(\/\/ Create analytics interaction\s*\n\s*const interaction = new AMCInteraction\(\{)/;
        if (syncPattern.test(content)) {
            content = content.replace(syncPattern, `
                // DISABLED: Download tracking now handled by universalDownloadTracker middleware
                console.log('⚠️ Skipping download sync - handled by middleware');
                continue;

                // Create analytics interaction (DISABLED)
                const interaction = new AMCInteraction({`);
            changes++;
            console.log('✅ Fixed /sync-download-events endpoint');
        }
        
        if (changes > 0) {
            // Write the fixed content back
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`\n🎉 Successfully disabled asset_download in ${changes} endpoints`);
            console.log('💡 All download tracking now handled exclusively by universalDownloadTracker middleware');
        } else {
            console.log('⚠️ No changes needed - endpoints may already be fixed');
        }
        
    } catch (error) {
        console.error('❌ Error disabling duplicate endpoints:', error.message);
        throw error;
    }
}

if (require.main === module) {
    disableDuplicateEndpoints()
        .then(() => {
            console.log('\n✅ Duplicate endpoint fix completed!');
            console.log('🔄 Please restart your server to apply changes');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Failed to disable duplicate endpoints:', error);
            process.exit(1);
        });
}

module.exports = { disableDuplicateEndpoints };