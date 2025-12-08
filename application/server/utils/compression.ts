import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { decompress as zstdDecompress } from '@mongodb-js/zstd'

/**
 * Decompress a zstd-compressed archive buffer
 * @param compressedBuffer - Compressed buffer
 * @param targetDir - Directory to extract files to
 */
export async function decompressDirectory(compressedBuffer: Buffer, targetDir: string): Promise<void> {
  // Decompress
  const uncompressed = Buffer.from(await zstdDecompress(compressedBuffer))
  
  // Parse the archive format
  let offset = 0
  
  while (offset < uncompressed.length) {
    // Read path length
    if (offset + 4 > uncompressed.length) break
    const pathLength = uncompressed.readUInt32LE(offset)
    offset += 4
    
    // Read path
    if (offset + pathLength > uncompressed.length) break
    const filePath = uncompressed.toString('utf8', offset, offset + pathLength)
    offset += pathLength
    
    // Read content length
    if (offset + 4 > uncompressed.length) break
    const contentLength = uncompressed.readUInt32LE(offset)
    offset += 4
    
    // Read content
    if (offset + contentLength > uncompressed.length) break
    const content = uncompressed.subarray(offset, offset + contentLength)
    offset += contentLength
    
    // Write file
    const fullPath = join(targetDir, filePath)
    const dirPath = dirname(fullPath)
    
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true })
    }
    
    writeFileSync(fullPath, content)
  }
}
