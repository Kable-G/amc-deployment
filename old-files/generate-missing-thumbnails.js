const CenterRelease = require('./models/CenterRelease');
const mongoose = require('mongoose');
const ffmpegStatic = require('ffmpeg-static');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

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

async function generateMissingThumbnails() {
    try {
        const mongoURI = process.env.MONGO_URI;
        if (!mongoURI) {
            throw new Error('MongoDB URI not found in .env file. Please set MONGO_URI.');
        }
        
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB Atlas');

        // Find all releases with videos
        const releases = await CenterRelease.find({
            'videos.0': { $exists: true }
        });

        console.log(`Found ${releases.length} releases with videos`);

        let totalThumbnailsGenerated = 0;
        let totalThumbnailsFailed = 0;

        for (const release of releases) {
            console.log(`\nProcessing release: ${release.title} (${release.uuid})`);
            console.log(`Videos in release: ${release.videos.length}`);

            let releaseUpdated = false;

            for (let i = 0; i < release.videos.length; i++) {
                const video = release.videos[i];
                
                console.log(`  Video ${i + 1}: ${video.originalName}`);
                console.log(`    Current thumbPath: ${video.thumbPath || 'NONE'}`);

                // Skip if thumbnail already exists
                if (video.thumbPath) {
                    console.log(`    Thumbnail already exists, skipping`);
                    continue;
                }

                // Only process video files
                if (video.mimetype && video.mimetype.startsWith('video/')) {
                    try {
                        const videoPath = path.join(__dirname, 'public', video.path);
                        
                        // Check if video file exists
                        if (!fs.existsSync(videoPath)) {
                            console.warn(`    Video file not found: ${videoPath}`);
                            totalThumbnailsFailed++;
                            continue;
                        }

                        const filename = path.basename(video.path);
                        const thumbnailFilename = `thumb_${filename.replace(/\.[^/.]+$/, '')}.jpg`;
                        const uploadDir = path.join(__dirname, 'public', 'uploads', 'center_assets');
                        const thumbnailPath = path.join(uploadDir, thumbnailFilename);
                        
                        await generateVideoThumbnail(videoPath, thumbnailPath);
                        
                        // Update the video object with thumbnail path
                        release.videos[i].thumbPath = `/uploads/center_assets/${thumbnailFilename}`;
                        totalThumbnailsGenerated++;
                        releaseUpdated = true;
                        
                        console.log(`    SUCCESS: Thumbnail generated for: ${video.originalName}`);
                    } catch (thumbError) {
                        console.warn(`    FAILED: Could not generate thumbnail for ${video.originalName}:`, thumbError.message);
                        totalThumbnailsFailed++;
                    }
                } else {
                    console.log(`    Skipping non-video file: ${video.mimetype}`);
                }
            }

            // Save the updated release if any thumbnails were generated
            if (releaseUpdated) {
                await release.save();
                console.log(`  Release updated and saved`);
            }
        }

        console.log(`\n=== SUMMARY ===`);
        console.log(`Total thumbnails generated: ${totalThumbnailsGenerated}`);
        console.log(`Total thumbnails failed: ${totalThumbnailsFailed}`);
        console.log(`Processed ${releases.length} releases`);

    } catch (error) {
        console.error('Error generating missing thumbnails:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

generateMissingThumbnails().then(() => {
    console.log('Script completed');
    process.exit(0);
}).catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
});