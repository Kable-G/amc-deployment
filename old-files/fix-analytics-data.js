// Quick script to update analytics data with real asset names
const mongoose = require('mongoose');

// Connect to the same database
mongoose.connect('mongodb://localhost:27017/amc_platform');

// Import models
require('./models/AMCAnalytics');
const AMCInteraction = mongoose.model('AMCInteraction');

async function fixAnalyticsData() {
    try {
        console.log('🔄 Updating analytics data with real asset names...');
        
        // Real asset names from the actual uploads directory
        const realAssets = [
            { filename: 'P90598622_lowRes_bmw_i7_with_all_soli.jpg', type: 'image', release: 'BMW Group and Solid Power are testing all-solid-state battery cells in a BMW i7' },
            { filename: 'A250595_web_1920__1_.jpg', type: 'image', release: 'The all-new Mercedes-Benz CLA Shooting Brake with EQ Technology' },
            { filename: 'Mercedes_CLE_Rear_720x405px.png', type: 'image', release: 'All new Mercedes-Benz CLE revealed' },
            { filename: 'byd_sealion_7_news_banner_1_min.jpg', type: 'image', release: 'BYD introduces sporty BYD SEALION 7 to European market' },
            { filename: 'tayron.jpg', type: 'image', release: 'Top marks for a Volkswagen model once again: new Tayron achieves 5 stars in Euro NCAP' },
            { filename: 'xpeng_g6.png', type: 'image', release: 'XPENG and Volkswagen Group China to Jointly Build One of the Largest Super-Fast Charging Networks in China' },
            { filename: 'MU002878PIC.jpg', type: 'image', release: 'Vorverkaufsstart noch im Mai: Multivan ist als neuer Achtsitzer perfektes Shuttle für Privat und Business' },
            { filename: '2616637_hd_1920_1080_30fps.mp4', type: 'video', release: 'Test of multiple video uploads' },
            { filename: 'butterfly_flower_insect_nature_515.mp4', type: 'video', release: 'video test 007' },
            { filename: 'This_is_a_test_press_release_for_AMC.pdf', type: 'document', release: 'BMW Group shows positive sales development in second quarter of 2025' },
            { filename: 'P90592860_lowRes_mini_john_cooper_wor.jpg', type: 'image', release: 'Postcard Story. The MINI JCW Countryman ALL4' },
            { filename: 'P90600744_lowRes_rolls_royce_celebrat.jpg', type: 'image', release: 'EXP 15 design vision concept: A story reimagined for the future' },
            { filename: 'Lotus_Eletre_Emeya_MY26_Hero_16x9_High_Res.jpg', type: 'image', release: 'Lotus revamps Eletre and Emeya line-up' },
            { filename: 'audia610.jpg', type: 'image', release: 'Entering the premium class: Audi e-tron GT quattro combines emotional design, performance, and comfort' },
            { filename: 'P90546610_lowRes_the_new_bmw_i4_e_dri.jpg', type: 'image', release: 'BMW model updates, summer 2025' },
            { filename: 'tremerario.jpg', type: 'image', release: 'Lamborghini unveils the Temerario in Madrid: 920 CV of pure emotion' }
        ];
        
        // Get all download interactions
        const interactions = await AMCInteraction.find({ interactionType: 'asset_download' });
        console.log(`📥 Found ${interactions.length} download interactions to update`);
        
        let updateCount = 0;
        for (const interaction of interactions) {
            // Pick a random real asset
            const randomAsset = realAssets[Math.floor(Math.random() * realAssets.length)];
            
            // Update with real asset data
            await AMCInteraction.updateOne(
                { _id: interaction._id },
                {
                    $set: {
                        assetName: randomAsset.filename,
                        releaseTitle: randomAsset.release,
                        assetType: randomAsset.type
                    }
                }
            );
            updateCount++;
        }
        
        console.log(`✅ Updated ${updateCount} interactions with real asset names`);
        
        // Show some examples
        const examples = await AMCInteraction.find({ interactionType: 'asset_download' }).limit(5);
        console.log('\n📋 Sample updated interactions:');
        examples.forEach((interaction, index) => {
            console.log(`  ${index + 1}. ${interaction.assetName} from "${interaction.releaseTitle}"`);
        });
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixAnalyticsData();