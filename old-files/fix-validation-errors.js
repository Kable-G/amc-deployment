/**
 * Fix Validation Errors - Quick script to resolve AMCInteraction validation issues
 * Run this after updating the schema to clear any pending validation errors
 */

const mongoose = require('mongoose');

async function fixValidationErrors() {
    try {
        console.log('🔧 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/amc', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Clear any invalid interaction types that might be causing issues
        console.log('🧹 Cleaning up invalid interaction types...');
        
        const validTypes = [
            'page_view', 'release_view', 'asset_download', 'asset_quick_view', 'asset_add_to_cart',
            'search_query', 'filter_applied', 'sort_changed', 'pagination_click', 'release_detail_view',
            'share_action', 'print_action', 'export_action', 'heartbeat', 'page_visible', 'page_hidden',
            'scroll_depth', 'time_on_page', 'page_exit'
        ];

        // Find any interactions with invalid types
        const { AMCInteraction } = require('./models/AMCAnalytics');
        
        const invalidInteractions = await AMCInteraction.find({
            interactionType: { $nin: validTypes }
        });

        console.log(`📊 Found ${invalidInteractions.length} interactions with invalid types`);

        if (invalidInteractions.length > 0) {
            console.log('Invalid types found:');
            const invalidTypes = [...new Set(invalidInteractions.map(i => i.interactionType))];
            invalidTypes.forEach(type => console.log(`  - ${type}`));

            // Option 1: Delete invalid interactions
            const deleteResult = await AMCInteraction.deleteMany({
                interactionType: { $nin: validTypes }
            });
            console.log(`🗑️  Deleted ${deleteResult.deletedCount} invalid interactions`);
        }

        // Test creating a new interaction to verify schema is working
        console.log('🧪 Testing new interaction creation...');
        
        const testInteraction = new AMCInteraction({
            userId: new mongoose.Types.ObjectId(),
            userEmail: 'test@example.com',
            sessionId: `test_${Date.now()}`,
            interactionType: 'page_view',
            userAgent: 'Test Agent',
            ipAddress: '127.0.0.1',
            country: 'Test Country',
            region: 'Test Region',
            city: 'Test City',
            timestamp: new Date(),
            metadata: {
                test: true
            }
        });

        await testInteraction.save();
        console.log('✅ Test interaction created successfully');

        // Clean up test interaction
        await AMCInteraction.deleteOne({ _id: testInteraction._id });
        console.log('🧹 Test interaction cleaned up');

        console.log('\n🎉 Validation errors fixed! Your analytics should now work properly.');
        console.log('📋 Summary:');
        console.log(`  ✅ Schema updated with new interaction types`);
        console.log(`  ✅ Invalid interactions cleaned up`);
        console.log(`  ✅ Validation test passed`);
        console.log('\n🚀 You can now restart your server and the validation errors should be gone.');

    } catch (error) {
        console.error('❌ Error fixing validation errors:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

// Run the fix
if (require.main === module) {
    fixValidationErrors();
}

module.exports = fixValidationErrors;