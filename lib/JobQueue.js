const DB = require('../src/DB');
const FF = require('./FF');
const util = require('./util');

// Manage resource, resource managment
//TODO: nice value for priority of process
// TODO: taskset assign only one core for process
class JobQueue {
    constructor() {
        this.jobs = []; // Queue
        this.currentJob = null;

        DB.update();
        DB.videos.forEach((video) => {
            // resizes: { '740x660': { processing: false }, '960x340': { processing: true } }
            // keys: [ '740x660', '960x340' ]
            Object.keys(video.resizes).forEach((key) => {
                // if TRUE
                if (video.resizes[key].processing) {
                    const [width, height] = key.split('x');
                    this.enqueue({
                        type: 'resize',
                        videoId: video.videoId,
                        width,
                        height,
                    });
                }
            });
        });
    }

    enqueue(job) {
        this.jobs.push(job); // { type width height }
        this.executeNext();
    }

    dequeue() {
        return this.jobs.shift();
    }

    executeNext() {
        // if we already doing something do nothing
        if (this.currentJob) return;

        this.currentJob = this.dequeue(); // dequeue

        if (!this.currentJob) return; // if resizing finished and after that nothing was in the array we donot want to call execute
        this.execute(this.currentJob);
    }

    async execute(job) {
        if (job.type === 'resize') {
            const { videoId, width, height } = job;
            DB.update();
            const video = DB.videos.find((video) => video.videoId === videoId);

            const originalVideoPath = `./storage/${video.videoId}/original.${video.extension}`;
            const targetVideoPath = `./storage/${video.videoId}/${width}x${height}.${video.extension}`;

            try {
                await FF.resize(originalVideoPath, targetVideoPath, width, height);

                DB.update();
                const video = DB.videos.find((video) => video.videoId === videoId); // we need to have updated
                video.resizes[`${width}x${height}`] = { processing: false };
                DB.save();
            } catch (error) {
                util.deleteFile(targetVideoPath);
            }
        }

        // kind a recursion
        this.currentJob = null;
        this.executeNext(); //
    }
}

module.exports = new JobQueue();
