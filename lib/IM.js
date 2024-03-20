const { spawn } = require('node:child_process');

// handles ImageMagic application
class IM {
    formatImage() {
        return new Promise((resolve, reject) => {
            const imProcess = spawn();

            imProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(`Something wnet wrong while image formatting. Exit code was: ${code}`);
                } else {
                    resolve();
                }
            });

            imProcess.on('error', (error) => {
                reject(error);
            });
        });
    }
}
