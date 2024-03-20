const path = require('node:path');
const cluster = require('node:cluster');
const { randomBytes } = require('node:crypto');
const { mkdir, open, stat } = require('node:fs/promises');
const { pipeline } = require('node:stream/promises');
const FF = require('../../lib/FF');


const util = require('../../lib/util');
const DB = require('../DB');

let jobs;
if(cluster.isPrimary) {
    jobs = require('../../lib/JobQueue');
}

// list of videos
const getVideos = (req, res, handleErr) => {
    DB.update();
    const videos = DB.videos.filter((video) => {
        return video.userId === req.userId;
    });

    res.status(200).json(videos);
};

// upload video
const uploadVideo = async (req, res, handleErr) => {
    const specifiedFileName = req.headers.filename;
    const { ext, name } = path.parse(specifiedFileName);
    const extension = ext.substring(1).toLowerCase();
    const videoId = randomBytes(4).toString('hex');

    const SUPPORTED_FORMATS = ['mp4', 'mov'];

    if (SUPPORTED_FORMATS.indexOf(extension) === -1)
        return handleErr({ status: 400, message: 'Unsupported file format' });

    try {
        await mkdir(`./storage/${videoId}`);
        const fullPath = `./storage/${videoId}/original.${extension}`;
        const fileHandle = await open(fullPath, 'w');
        const fileStream = fileHandle.createWriteStream();
        const thumbnailPath = `./storage/${videoId}/thumbnail.jpg`;

        await pipeline(req, fileStream);

        // Make a thumbnail for the video file
        await FF.makeThumbnail(fullPath, thumbnailPath);

        // Get the dimensions
        const dimensions = await FF.getDimensions(fullPath);

        DB.update();
        DB.videos.unshift({
            id: DB.videos.length,
            videoId,
            name,
            extension,
            dimensions,
            userId: req.userId,
            extractedAudio: false,
            resizes: {},
        });
        DB.save();

        res.status(201).json({
            status: 'success',
            message: 'The file was uploaded successfully!',
        });
    } catch (error) {
        // Deelte the folder
        util.deleteFolder(`./storage/${videoId}`);
        if (error.code !== 'ECONNRESET') return handleErr(error);
    }
};

// extract audio for video file
const extractAudio = async (req, res, handleErr) => {
    const videoId = req.params.get('videoId');
    DB.update();

    const video = DB.videos.find((video) => {
        return video.videoId === videoId;
    });

    if (video.extractedAudio) {
        return handleErr({
            status: 400,
            message: 'The audio has already been extracted for this video.',
        });
    }

    try {
        const originalVideoPath = `./storage/${videoId}/original.${video.extension}`;
        const targetAudioPath = `./storage/${videoId}/audio.aac`;

        await FF.extractAudio(originalVideoPath, targetAudioPath);

        video.extractedAudio = true;
        DB.save();

        res.status(200).json({
            status: 'success',
            message: 'The audio was extracted successfully!',
        });
    } catch (error) {
        // util.deleteFile(targetAudioPath);
        // video.extractedAudio = false;
        DB.save();
        return handleErr(error);
    }
};

// resize video
const resizeVideo = async (req, res, handleErr) => {
    let { videoId, width, height } = req.body;
    const video = DB.videos.find((video) => video.videoId === videoId);
    video.resizes[`${width}x${height}`] = { processing: true };
    DB.save();

    if(cluster.isPrimary) {
        // enquqe new job in queue
        jobs.enqueue({
            type: 'resize',
            videoId,
            width,
            height,
        });
    } else {
        process.send({
            messageType: 'new-resize',
            data: { videoId, width, height }
        });
    }

    res.status(200).json({
        status: 'success',
        message: 'The video is now being processed!',
    });
};

// Get different type of assets
const getVideoAsset = async (req, res, handleErr) => {
    const videoId = req.params.get('videoId');
    const type = req.params.get('type');

    DB.update();
    const video = DB.videos.find((video) => video.videoId === videoId);

    if (!video) {
        return handleErr({
            status: 404,
            message: 'Video not found!',
        });
    }

    let file;
    let mimeType;
    let filename; // filename for download including extension. when user clicks on download his is what will be the name of the file

    switch (type) {
        case 'thumbnail':
            file = await open(`./storage/${videoId}/thumbnail.jpg`, 'r');
            mimeType = 'image/jpeg';
            break;
        case 'original':
            file = await open(`./storage/${videoId}/original.${video.extension}`, 'r');
            mimeType = 'video/mp4'; // TODO: improve
            filename = `${video.name}.${video.extension}`;
            break;
        case 'audio':
            file = await open(`./storage/${videoId}/audio.aac`, 'r');
            mimeType = 'audio/aac';
            filename = `${video.name}-audio.acc`;
            break;
        case 'resize':
            const dimensions = req.params.get('dimensions');
            file = await open(`./storage/${videoId}/${dimensions}.${video.extension}`, 'r');
            mimeType = 'video/mp4';
            filename = `${video.name}-${dimensions}.${video.extension}`;
            break;
        default:
            break;
    }

    try {
        const { size } = await file.stat();
        const fileStream = file.createReadStream();

        if (type !== 'thumbnail') {
            // set header to prompt for download
            res.setHeader('Content-Disposition', `attachement; filename=${filename}`);
        }

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', size);

        res.status(200);
        await pipeline(fileStream, res);

        file.close();
    } catch (error) {
        console.log(error);
    }
};

module.exports = {
    getVideos,
    uploadVideo,
    extractAudio,
    resizeVideo,
    getVideoAsset,
};
