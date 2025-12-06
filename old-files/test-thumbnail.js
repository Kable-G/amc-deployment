const ffmpegStatic = require('ffmpeg-static');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function testThumbnailGeneration() {
    const videoPath = path.join(__dirname, 'public', 'uploads', 'center_assets', '1752825608841-6863085_SampleVideo_1280x720_1mb.mp4');
    const outputPath = path.join(__dirname, 'public', 'uploads', 'center_assets', 'test_thumb.jpg');

    console.log('Video path:', videoPath);
    console.log('Output path:', outputPath);
    console.log('Video exists:', fs.existsSync(videoPath));
    console.log('FFmpeg path:', ffmpegStatic);
    console.log('FFmpeg exists:', fs.existsSync(ffmpegStatic));

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegStatic, [
            '-i', videoPath,
            '-ss', '00:00:01',
            '-vframes', '1',
            '-vf', 'scale=320:240',
            '-y',
            outputPath
        ]);

        let stderr = '';
        let stdout = '';

        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log('STDERR:', data.toString());
        });

        ffmpeg.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log('STDOUT:', data.toString());
        });

        ffmpeg.on('close', (code) => {
            console.log('FFmpeg exit code:', code);
            console.log('Output file exists:', fs.existsSync(outputPath));
            
            if (code === 0) {
                console.log('SUCCESS: Thumbnail generated');
                resolve(true);
            } else {
                console.log('FAILED: FFmpeg error');
                console.log('Full stderr:', stderr);
                resolve(false);
            }
        });

        ffmpeg.on('error', (err) => {
            console.log('FFmpeg spawn error:', err);
            reject(err);
        });
    });
}

testThumbnailGeneration().then(success => {
    console.log('Test completed. Success:', success);
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
});