const fs = require('fs');
const path = require('path');

async function fixSyntaxError() {
    console.log('🔧 Fixing syntax error in amcAnalytics.routes.js...');
    
    const filePath = path.join(__dirname, 'routes', 'amcAnalytics.routes.js');
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Fix the illegal continue statement by replacing it with return
        content = content.replace(
            /\/\/ Skip asset_download - handled by universalDownloadTracker middleware\s*\n\s*if \(interactionType === 'asset_download'\) \{\s*\n\s*continue; \/\/ Skip this interaction in batch\s*\n\s*\}/,
            `// Skip asset_download - handled by universalDownloadTracker middleware
            if (interactionType === 'asset_download') {
                return res.status(200).json({ 
                    success: true, 
                    message: 'Download tracking handled by middleware',
                    skipped: true 
                });
            }`
        );
        
        // Also fix any other continue statements that might be problematic
        content = content.replace(
            /continue; \/\/ Skip this interaction in batch/g,
            `return res.status(200).json({ 
                success: true, 
                message: 'Download tracking handled by middleware',
                skipped: true 
            });`
        );
        
        // Fix the sync endpoint continue as well
        content = content.replace(
            /console\.log\('⚠️ Skipping download sync - handled by middleware'\);\s*\n\s*continue;/,
            `console.log('⚠️ Skipping download sync - handled by middleware');
                return res.status(200).json({ 
                    success: true, 
                    message: 'Download sync disabled - handled by middleware',
                    skipped: true 
                });`
        );
        
        // Write the fixed content back
        fs.writeFileSync(filePath, content, 'utf8');
        
        console.log('✅ Fixed syntax error - replaced continue with return statements');
        console.log('🔄 Server should now start without syntax errors');
        
    } catch (error) {
        console.error('❌ Error fixing syntax error:', error.message);
        throw error;
    }
}

if (require.main === module) {
    fixSyntaxError()
        .then(() => {
            console.log('\n🎉 Syntax error fixed successfully!');
            console.log('✅ You can now restart your server');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Failed to fix syntax error:', error);
            process.exit(1);
        });
}

module.exports = { fixSyntaxError };