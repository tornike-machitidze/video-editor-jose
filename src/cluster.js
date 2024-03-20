const cluster = require('node:cluster');

const jobs = require('../lib/JobQueue');

if (cluster.isPrimary) {
    const corsCount = require('node:os').availableParallelism();

    // spawn new node process for each core
    for (let i = 0; i < corsCount; i++) {
        cluster.fork();
    }

    cluster.on('message', (worker, message) => {
        if (message.messageType === 'new-resize') {
            const { videoId, width, height } = message.data;

            jobs.enqueue({
                type: 'resize',
                videoId,
                width,
                height,
            });
        }
    });

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died ${signal} | ${code}. Restarting...`);
        cluster.fork();
    });

} else {
    require('./index');
}
