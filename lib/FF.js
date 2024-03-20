const { spawn } = require('node:child_process');

// TODO: ImageMagic - image editing application. We can use it additionali here
class FF {
    makeThumbnail(fullPath, thumbnailPath) {
        return new Promise((resolve, reject) => {
            const ffmpegProcess = spawn('ffmpeg', ['-i', fullPath, '-ss', '4', '-vframes', '1', thumbnailPath]);

            ffmpegProcess.on('close', (code) => {
                if (code !== 0) {
                    // if something wrong happend
                    reject(`Something went wrong while taking thumbnail. Exit code was: ${code}`);
                } else {
                    // if everything went Successfully
                    resolve();
                }
            });

            ffmpegProcess.on('error', (error) => {
                reject('FFempeg: take thumbnail error: ', error);
            });
        });
    }

    getDimensions(fullPath) {
        // ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 .\original.mp4
        return new Promise((resolve, reject) => {
            const ffprobeProcess = spawn('ffprobe', [
                '-v',
                'error',
                '-select_streams',
                'v:0',
                '-show_entries',
                'stream=width,height',
                '-of',
                'csv=p=0',
                fullPath,
            ]);

            let dimensions = '';

            ffprobeProcess.stdout.on('data', (data) => {
                dimensions += data;
            });

            ffprobeProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(`Something went wrong while getting dimensions. Exit code was: ${code}`);
                } else {
                    const [width, height] = dimensions.trim().split(',');
                    resolve({ width: +width, height: +height });
                }
            });

            ffprobeProcess.on('error', (error) => {
                reject(error);
            });
        });
    }

    extractAudio (originalVideoPath, targetAudioPath) {
        return new Promise((resolve, reject) => {
            // ffmpeg -i video.mp4 -vn -c:a copy audio.aac
            const ffmpegProcess = spawn('ffmpeg', ['-i', originalVideoPath, '-vn', '-c:a', 'copy', targetAudioPath]);

            ffmpegProcess.on('close', (code) => {
                if (code !== 0) {
                    reject('Something went wrong while extracting audio. Exit code was: ' + code);
                } else {
                    resolve();
                }
            });

            ffmpegProcess.on('error', (error) => {
                reject(error);
            })

        });
    }

    resize (originalVideoPath, targetVideoPath, width, height) {
        return new Promise((resolve, reject) => {
            // ffmpeg -i video.mp4 -vh scale=320:240 -c:a copy video-320x240.mp4

            const ffmpegProcess = spawn('ffmpeg', ['-i', originalVideoPath, '-vf', `scale=${width}:${height}`, '-c:a', 'copy', '-threads', '2', '-y', targetVideoPath ]);

            ffmpegProcess.on('close', (code) => {
                if(code !== 0) {
                    reject('Something went wrong whil resizing video. Exit code was: ' + code);
                } else {
                    resolve();
                }
            });

            ffmpegProcess.on('error', (error) => {
                reject(error);
            });
        });
    }
}


module.exports = new FF();
