const CenterRelease = require('./models/CenterRelease');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ffmpegStatic = require('ffmpeg-static');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Function to generate video thumbnail using FFmpeg static binary
async function generateVideoThumbnail(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log(`Generating video thumbnail: ${videoPath} -> ${outputPath}`);
        
        // Use the static FFmpeg binary
        const ffmpeg = spawn(ffmpegStatic, [
            '-i', videoPath,           // Input video file
            '-ss', '00:00:01',         // Seek to 1 second (to avoid black frames)
            '-vframes', '1',           // Extract only 1 frame
            '-vf', 'scale=320:240',    // Scale to thumbnail size
            '-y',                      // Overwrite output file if it exists
            outputPath                 // Output thumbnail path
        ]);

        let stderr = '';
        
        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log(`SUCCESS: Video thumbnail generated: ${outputPath}`);
                resolve(outputPath);
            } else {
                console.error(`FFmpeg failed with code ${code}:`, stderr);
                reject(new Error(`FFmpeg failed: ${stderr}`));
            }
        });

        ffmpeg.on('error', (err) => {
            console.error('FFmpeg spawn error:', err);
            reject(err);
        });
    });
}

async function testNewUploadThumbnail() {
    try {
        const mongoURI = process.env.MONGO_URI;
        if (!mongoURI) {
            throw new Error('MongoDB URI not found in .env file. Please set MONGO_URI.');
        }
        
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB Atlas');

        // Find the most recent release
        const recentReleases = await CenterRelease.find({})
            .select('title uuid videos createdAt')
            .sort({ createdAt: -1 })
            .limit(3);

        console.log('\nRecent releases:');
        recentReleases.forEach((release, index) => {
            console.log(`${index + 1}. ${release.title} (${release.uuid})`);
            console.log(`   Created: ${release.createdAt}`);
            console.log(`   Videos: ${release.videos.length}`);
            if (release.videos.length > 0) {
                release.videos.forEach((video, vIndex) => {
                    console.log(`     Video ${vIndex + 1}: ${video.originalName}`);
                    console.log(`       thumbPath: ${video.thumbPath || 'NONE'}`);
                    console.log(`       mimetype: ${video.mimetype}`);
                });
            }
            console.log('');
        });

        // Test thumbnail generation on the most recent release with videos
        const releaseWithVideos = recentReleases.find(r => r.videos.length > 0);
        if (releaseWithVideos) {
            console.log(`\nTesting thumbnail generation for: ${releaseWithVideos.title}`);
            
            for (let i = 0; i < releaseWithVideos.videos.length; i++) {
                const video = releaseWithVideos.videos[i];
                
                if (!video.thumbPath && video.mimetype && video.mimetype.startsWith('video/')) {
                    console.log(`\nAttempting to generate thumbnail for: ${video.originalName}`);
                    
                    try {
                        const videoPath = path.join(__dirname, 'public', video.path);
                        console.log(`Video file path: ${videoPath}`);
                        console.log(`Video file exists: ${fs.existsSync(videoPath)}`);
                        
                        if (fs.existsSync(videoPath)) {
                            const filename = path.basename(video.path);
                            const thumbnailFilename = `thumb_${filename.replace(/\.[^/.]+$/, '')}.jpg`;
                            const uploadDir = path.join(__dirname, 'public', 'uploads', 'center_assets');
                            const thumbnailPath = path.join(uploadDir, thumbnailFilename);
                            
                            await generateVideoThumbnail(videoPath, thumbnailPath);
                            
                            // Update the database
                            const fullRelease = await CenterRelease.findById(releaseWithVideos._id);
                            fullRelease.videos[i].thumbPath = `/uploads/center_assets/${thumbnailFilename}`;
                            await fullRelease.save();
                            
                            console.log(`SUCCESS: Thumbnail generated and saved for: ${video.originalName}`);
                        } else {
                            console.log(`ERROR: Video file not found: ${videoPath}`);
                        }
                    } catch (error) {
                        console.error(`ERROR generating thumbnail for ${video.originalName}:`, error.message);
                    }
                } else if (video.thumbPath) {
                    console.log(`Thumbnail already exists for: ${video.originalName}`);
                } else {
                    console.log(`Skipping non-video file: ${video.originalName}`);
                }
            }
        } else {
            console.log('No recent releases with videos found');
        }

        mongoose.disconnect();
        console.log('\nTest completed');

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testNewUploadThumbnail();