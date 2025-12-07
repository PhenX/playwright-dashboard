import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { extname, join } from 'path'

export default eventHandler(async (event) => {
  const path = getRouterParam(event, 'path')
  
  if (!path) {
    throw createError({
      statusCode: 400,
      message: 'File path is required'
    })
  }

  // Security: Prevent path traversal
  if (path.includes('..') || path.startsWith('/')) {
    throw createError({
      statusCode: 403,
      message: 'Invalid file path'
    })
  }

  const storagePath = process.env.STORAGE_PATH || '.data/storage'
  const { join } = await import('path')
  const fullPath = join(storagePath, path)

  if (!existsSync(fullPath)) {
    throw createError({
      statusCode: 404,
      message: 'File not found'
    })
  }

  try {
    const fileContent = await readFile(fullPath)
    const ext = extname(fullPath).toLowerCase()
    
    // Set appropriate content type
    let contentType = 'application/octet-stream'
    if (ext === '.html' || ext === '.htm') {
      contentType = 'text/html'
    } else if (ext === '.zip') {
      contentType = 'application/zip'
    } else if (ext === '.json') {
      contentType = 'application/json'
    }

    setResponseHeader(event, 'Content-Type', contentType)
    setResponseHeader(event, 'Content-Length', fileContent.length.toString())
    
    return fileContent
  } catch (error: any) {
    console.error('Failed to read file:', fullPath, error)
    throw createError({
      statusCode: 500,
      message: error.code === 'EACCES' ? 'Permission denied' : 'Failed to read file'
    })
  }
})
