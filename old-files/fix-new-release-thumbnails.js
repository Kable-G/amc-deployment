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
        
        // Check if input file exists
        if (!fs.existsSync(videoPath)) {
            const error = new Error(`Video file does not exist: ${videoPath}`);
            console.error(`ERROR: ${error.message}`);
            reject(error);
            return;
        }
        
        const stats = fs.statSync(videoPath);
        console.log(`Video file size: ${stats.size} bytes`);
        
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
                // Check if output file was created
                if (fs.existsSync(outputPath)) {
                    const outputStats = fs.statSync(outputPath);
                    console.log(`SUCCESS: Thumbnail created, size: ${outputStats.size} bytes`);
                    resolve(outputPath);
                } else {
                    const error = new Error(`FFmpeg succeeded but output file not found: ${outputPath}`);
                    console.error(`ERROR: ${error.message}`);
                    reject(error);
                }
            } else {
                const error = new Error(`FFmpeg failed with code ${code}: ${stderr}`);
                console.error(`ERROR: ${error.message}`);
                reject(error);
            }
        });

        ffmpeg.on('error', (err) => {
            console.error(`FFmpeg spawn error: ${err.message}`);
            reject(err);
        });
    });
}

async function fixNewReleaseThumbnails() {
    try {
        const mongoURI = process.env.MONGO_URI;
        if (!mongoURI) {
            throw new Error('MongoDB URI not found in .env file. Please set MONGO_URI.');
        }
        
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB Atlas');

        // Find the new test release
        const release = await CenterRelease.findOne({ 
            title: 'new video upload as test of thumbnail generation' 
        });

        if (!release) {
            console.log('New test release not found');
            
            // Show recent releases
            const recent = await CenterRelease.find({})
                .select('title createdAt videos')
                .sort({ createdAt: -1 })
                .limit(5);
            
            console.log('\nRecent releases:');
            recent.forEach((r, i) => {
                console.log(`${i+1}. ${r.title}`);
                console.log(`   Created: ${r.createdAt}`);
                console.log(`   Videos: ${r.videos.length}`);
            });
            
            mongoose.disconnect();
            return;
        }

        console.log(`\nFound release: ${release.title}`);
        console.log(`UUID: ${release.uuid}`);
        console.log(`Videos: ${release.videos.length}`);

        let thumbnailsGenerated = 0;
        let thumbnailsFailed = 0;
        const uploadDir = path.join(__dirname, 'public', 'uploads', 'center_assets');

        // Process all videos in the release
        for (let i = 0; i < release.videos.length; i++) {
            const video = release.videos[i];
            
            console.log(`\nProcessing video ${i+1}: ${video.originalName}`);
            console.log(`  Current thumbPath: ${video.thumbPath || 'NONE'}`);
            console.log(`  Mimetype: ${video.mimetype}`);
            console.log(`  Path: ${video.path}`);

            // Skip if thumbnail already exists
            if (video.thumbPath) {
                console.log(`  Thumbnail already exists, skipping`);
                continue;
            }

            // Only process video files
            if (video.mimetype && video.mimetype.startsWith('video/')) {
                try {
                    const videoPath = path.join(__dirname, 'public', video.path);
                    
                    // Check if video file exists
                    if (!fs.existsSync(videoPath)) {
                        console.warn(`  Video file not found: ${videoPath}`);
                        thumbnailsFailed++;
                        continue;
                    }

                    const filename = path.basename(video.path);
                    const thumbnailFilename = `thumb_${filename.replace(/\.[^/.]+$/, '')}.jpg`;
                    const thumbnailPath = path.join(uploadDir, thumbnailFilename);
                    
                    console.log(`  Generating thumbnail: ${thumbnailFilename}`);
                    await generateVideoThumbnail(videoPath, thumbnailPath);
                    
                    // Update the video object with thumbnail path
                    release.videos[i].thumbPath = `/uploads/center_assets/${thumbnailFilename}`;
                    thumbnailsGenerated++;
                    
                    console.log(`  SUCCESS: Thumbnail generated for: ${video.originalName}`);
                } catch (thumbError) {
                    console.warn(`  FAILED: Could not generate thumbnail for ${video.originalName}:`, thumbError.message);
                    thumbnailsFailed++;
                }
            } else {
                console.log(`  Skipping non-video file: ${video.originalName}`);
            }
        }

        // Save the updated release
        if (thumbnailsGenerated > 0) {
            await release.save();
            console.log(`\nRelease updated and saved with ${thumbnailsGenerated} new thumbnails`);
        }

        console.log(`\n=== SUMMARY ===`);
        console.log(`Thumbnails generated: ${thumbnailsGenerated}`);
        console.log(`Thumbnails failed: ${thumbnailsFailed}`);
        console.log(`Total videos processed: ${release.videos.length}`);

        mongoose.disconnect();
        console.log('\nScript completed');

    } catch (error) {
        console.error('Script failed:', error);
        process.exit(1);
    }
}

fixNewReleaseThumbnails();