// Debug script to trace thumbnail logic
console.log('=== THUMBNAIL DEBUG SCRIPT ===');

// Simulate the populateAssetSection function logic
function debugThumbnailLogic(item, type) {
    console.log(`\n🔍 DEBUGGING: ${item.originalName || 'Unknown'}`);
    console.log(`   Type: ${type}`);
    console.log(`   item.thumbPath: ${item.thumbPath || 'NONE'}`);
    console.log(`   item.thumb: ${item.thumb || 'NONE'}`);
    console.log(`   item.path: ${item.path || 'NONE'}`);
    console.log(`   item.mimetype: ${item.mimetype || 'NONE'}`);
    
    let isActualImageThumb = true;
    let thumbSrc = 'https://via.placeholder.com/100x75.png?text=No+Preview';
    const API_BASE_URL = 'http://localhost:5000';
    
    if (item.thumbPath) {
        thumbSrc = `${API_BASE_URL}${item.thumbPath}`;
        isActualImageThumb = true;
        console.log(`   ✅ Using thumbPath: ${thumbSrc}`);
    } else if (type === 'image' && item.path) {
        thumbSrc = `${API_BASE_URL}${item.path}`;
        isActualImageThumb = true;
        console.log(`   ✅ Using image path: ${thumbSrc}`);
    } else if (item.thumb) {
        thumbSrc = item.thumb.startsWith('http') ? item.thumb : `${API_BASE_URL}${item.thumb}`;
        isActualImageThumb = true;
        console.log(`   ✅ Using thumb: ${thumbSrc}`);
    } else if (type === 'video') {
        isActualImageThumb = false;
        console.log(`   ❌ No thumbnail - will show blue placeholder`);
    }
    
    console.log(`   Final result: isActualImageThumb = ${isActualImageThumb}`);
    console.log(`   Final thumbSrc: ${thumbSrc}`);
    
    return { isActualImageThumb, thumbSrc };
}

// Test with sample data
const testVideo = {
    originalName: 'test-video.mp4',
    thumbPath: '/uploads/center_assets/thumb_123_test.jpg',
    path: '/uploads/center_assets/video.mp4',
    mimetype: 'video/mp4'
};

debugThumbnailLogic(testVideo, 'video');

const testVideoNoThumb = {
    originalName: 'test-video-no-thumb.mp4',
    path: '/uploads/center_assets/video2.mp4',
    mimetype: 'video/mp4'
};

debugThumbnailLogic(testVideoNoThumb, 'video');