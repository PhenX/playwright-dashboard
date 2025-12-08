const fs = require('fs');
const path = require('path');
const { compress } = require('@mongodb-js/zstd');

/**
 * Compress a directory using zstd compression
 * Creates a tar-like structure in memory and compresses with zstd
 * @param {string} sourceDir - Directory to compress
 * @returns {Promise<Buffer>} - Compressed buffer
 */
async function compressDirectory(sourceDir) {
  // Create a simple archive format in memory
  const files = [];
  
  // Recursively collect all files
  function collectFiles(dir, baseDir = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(baseDir, entry.name);
      
      if (entry.isDirectory()) {
        collectFiles(fullPath, relativePath);
      } else if (entry.isFile()) {
        const content = fs.readFileSync(fullPath);
        files.push({
          path: relativePath,
          size: content.length,
          content: content
        });
      }
    }
  }
  
  collectFiles(sourceDir);
  
  // Create a simple archive format:
  // For each file: [path_length (4 bytes)][path][content_length (4 bytes)][content]
  const parts = [];
  
  for (const file of files) {
    const pathBuffer = Buffer.from(file.path, 'utf8');
    const pathLengthBuffer = Buffer.allocUnsafe(4);
    pathLengthBuffer.writeUInt32LE(pathBuffer.length, 0);
    
    const contentLengthBuffer = Buffer.allocUnsafe(4);
    contentLengthBuffer.writeUInt32LE(file.content.length, 0);
    
    parts.push(pathLengthBuffer, pathBuffer, contentLengthBuffer, file.content);
  }
  
  const uncompressed = Buffer.concat(parts);
  
  // Compress with zstd
  const compressed = await compress(uncompressed, 9); // Level 9 for maximum compression
  
  return Buffer.from(compressed);
}

/**
 * Decompress a zstd-compressed archive buffer
 * @param {Buffer} compressedBuffer - Compressed buffer
 * @param {string} targetDir - Directory to extract files to
 * @returns {Promise<void>}
 */
async function decompressDirectory(compressedBuffer, targetDir) {
  const { decompress } = require('@mongodb-js/zstd');
  
  // Decompress
  const uncompressed = Buffer.from(await decompress(compressedBuffer));
  
  // Parse the archive format
  let offset = 0;
  
  while (offset < uncompressed.length) {
    // Read path length
    if (offset + 4 > uncompressed.length) break;
    const pathLength = uncompressed.readUInt32LE(offset);
    offset += 4;
    
    // Read path
    if (offset + pathLength > uncompressed.length) break;
    const filePath = uncompressed.toString('utf8', offset, offset + pathLength);
    offset += pathLength;
    
    // Read content length
    if (offset + 4 > uncompressed.length) break;
    const contentLength = uncompressed.readUInt32LE(offset);
    offset += 4;
    
    // Read content
    if (offset + contentLength > uncompressed.length) break;
    const content = uncompressed.slice(offset, offset + contentLength);
    offset += contentLength;
    
    // Write file
    const fullPath = path.join(targetDir, filePath);
    const dirPath = path.dirname(fullPath);
    
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content);
  }
}

module.exports = {
  compressDirectory,
  decompressDirectory
};
