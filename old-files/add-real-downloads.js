// add-real-downloads.js - Add your real image downloads to analytics via API
const https = require('https');
const http = require('http');

function makeRequest(url, options, data) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https:') ? https : http;
        const req = protocol.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    json: () => Promise.resolve(JSON.parse(body))
                });
            });
        });
        
        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

const API_BASE_URL = 'http://localhost:5000';

async function addRealDownloads() {
    try {
        console.log('🔄 Adding your real image downloads to analytics...');
        
        // Your actual image downloads from the Mercedes AMG release
        const realDownloads = [
            {
                assetName: '25C0209_002.jpg',
                assetType: 'image',
                releaseTitle: 'CONCEPT AMG GT TRACK SPORT: new high-performance project from Mercedes-AMG',
                releaseUuid: '8cdfe5db-cf03-4584-b0d4-eb6173b37229'
            },
            {
                assetName: '25C0209_003.jpg',
                assetType: 'image',
                releaseTitle: 'CONCEPT AMG GT TRACK SPORT: new high-performance project from Mercedes-AMG',
                releaseUuid: '8cdfe5db-cf03-4584-b0d4-eb6173b37229'
            },
            {
                assetName: '25C0209_004.jpg',
                assetType: 'image',
                releaseTitle: 'CONCEPT AMG GT TRACK SPORT: new high-performance project from Mercedes-AMG',
                releaseUuid: '8cdfe5db-cf03-4584-b0d4-eb6173b37229'
            },
            {
                assetName: '25C0209_005.jpg',
                assetType: 'image',
                releaseTitle: 'CONCEPT AMG GT TRACK SPORT: new high-performance project from Mercedes-AMG',
                releaseUuid: '8cdfe5db-cf03-4584-b0d4-eb6173b37229'
            }
        ];
        
        let successCount = 0;
        
        for (const download of realDownloads) {
            try {
                const requestData = {
                    interactionType: 'asset_download',
                    releaseUuid: download.releaseUuid,
                    releaseTitle: download.releaseTitle,
                    assetType: download.assetType,
                    assetName: download.assetName,
                    assetPath: `/uploads/center_assets/${download.assetName}`,
                    metadata: {
                        realUserDownload: true,
                        addedViaScript: true,
                        timestamp: new Date().toISOString()
                    }
                };
                
                const response = await makeRequest(`${API_BASE_URL}/api/v1/amc-analytics/track`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }, requestData);
                
                if (response.ok) {
                    console.log(`✅ Added download: ${download.assetName}`);
                    successCount++;
                } else {
                    console.log(`❌ Failed to add: ${download.assetName} - ${response.status}`);
                }
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Error adding ${download.assetName}:`, error.message);
            }
        }
        
        console.log(`🎉 Successfully added ${successCount}/${realDownloads.length} real downloads to analytics!`);
        
        // Check the results
        console.log('\n📊 Checking analytics data...');
        
        try {
            const assetTypeResponse = await makeRequest(`${API_BASE_URL}/api/v1/amc-analytics/downloads-by-asset-type`, {
                method: 'GET'
            });
            if (assetTypeResponse.ok) {
                const data = await assetTypeResponse.json();
                console.log('\n📈 Downloads by Asset Type:');
                data.data.forEach(item => {
                    console.log(`  ${item.assetType}: ${item.downloads} downloads`);
                });
            }
        } catch (error) {
            console.log('Could not fetch updated analytics data:', error.message);
        }
        
    } catch (error) {
        console.error('❌ Error adding real downloads:', error);
    }
}

addRealDownloads();