const fs = require('node:fs/promises');
const util = {};

// Delete a file if exists
util.deleteFile = async (path) => {
  try {
    await fs.unlink(path);
  } catch (error) {
    // do nothing
  }
}

// Delete a folder if exists
util.deleteFolder = async (path) => {
  try {
    await fs.rm(path, { recursive: true });
  } catch (error) {
    // do nothing
  }
}

module.exports = util;