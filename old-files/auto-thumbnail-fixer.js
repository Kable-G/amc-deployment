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
        if (!fs.existsSync(videoPath)) {
            reject(new Error(`Video file does not exist: ${videoPath}`));
            return;
        }
        
        const ffmpeg = spawn(ffmpegStatic, [
            '-i', videoPath, '-ss', '00:00:01', '-vframes', '1', 
            '-vf', 'scale=320:240', '-y', outputPath
        ]);

        let stderr = '';
        ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
        ffmpeg.on('close', (code) => {
            if (code === 0 && fs.existsSync(outputPath)) {
                resolve(outputPath);
            } else {
                reject(new Error(`FFmpeg failed: ${stderr}`));
            }
        });
        ffmpeg.on('error', reject);
    });
}

async function autoFixMissingThumbnails() {
    try {
        const mongoURI = process.env.MONGO_URI;
        if (!mongoURI) {
            throw new Error('MongoDB URI not found in .env file. Please set MONGO_URI.');
        }
        
        await mongoose.connect(mongoURI);
        console.log(`[${new Date().toISOString()}] 🔧 AUTO-FIX: Checking for missing thumbnails...`);
        
        // Find ALL releases with videos that don't have thumbnails
        const releases = await CenterRelease.find({
            'videos': {
                $elemMatch: {
                    'mimetype': { $regex: '^video/' },
                    'thumbPath': { $exists: false }
                }
            }
        });
        
        if (releases.length === 0) {
            console.log(`[${new Date().toISOString()}] ✅ No missing thumbnails found`);
            mongoose.disconnect();
            return;
        }
        
        console.log(`[${new Date().toISOString()}] 🎬 Found ${releases.length} releases with missing thumbnails`);
        
        let totalFixed = 0;
        const uploadDir = path.join(__dirname, 'public', 'uploads', 'center_assets');
        
        for (const release of releases) {
            let releaseFixed = 0;
            let releaseUpdated = false;
            
            for (let i = 0; i < release.videos.length; i++) {
                const video = release.videos[i];
                
                if (!video.thumbPath && video.mimetype && video.mimetype.startsWith('video/')) {
                    try {
                        const videoPath = path.join(__dirname, 'public', video.path);
                        const filename = path.basename(video.path);
                        const thumbnailFilename = `thumb_${filename.replace(/\.[^/.]+$/, '')}.jpg`;
                        const thumbnailPath = path.join(uploadDir, thumbnailFilename);
                        
                        await generateVideoThumbnail(videoPath, thumbnailPath);
                        release.videos[i].thumbPath = `/uploads/center_assets/${thumbnailFilename}`;
                        releaseFixed++;
                        totalFixed++;
                        releaseUpdated = true;
                        
                        console.log(`[${new Date().toISOString()}] ✅ Generated: ${video.originalName} -> ${thumbnailFilename}`);
                    } catch (error) {
                        console.log(`[${new Date().toISOString()}] ❌ Failed: ${video.originalName} - ${error.message}`);
                    }
                }
            }
            
            if (releaseUpdated) {
                await release.save();
                console.log(`[${new Date().toISOString()}] 💾 Updated "${release.title}" with ${releaseFixed} thumbnails`);
            }
        }
        
        console.log(`[${new Date().toISOString()}] 🎯 AUTO-FIX COMPLETE: Generated ${totalFixed} thumbnails`);
        mongoose.disconnect();
        
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ AUTO-FIX ERROR:`, error);
        if (mongoose.connection.readyState === 1) {
            mongoose.disconnect();
        }
    }
}

// Run the auto-fix function
autoFixMissingThumbnails();