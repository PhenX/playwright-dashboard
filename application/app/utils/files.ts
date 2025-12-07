/**
 * Convert file path to API file path
 * Removes the storage path prefix if present to create a relative path for the API
 * If the path is already relative, returns it as-is
 */
export function getFileApiPath(filePath: string): string {
  // If path is already relative (doesn't start with . or /), return as-is
  if (!filePath.startsWith('.') && !filePath.startsWith('/')) {
    return filePath
  }
  
  // Remove storage path prefix for backward compatibility with absolute paths
  const storagePath = '.data/storage/'
  return filePath.replace(storagePath, '')
}
