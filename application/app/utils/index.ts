import { h } from 'vue'
import { UIcon } from '#components'
import type { Column } from '@tanstack/vue-table'
import { formatDuration as formatDurationLib } from 'date-fns'

/**
 * Creates a sortable column header render function.
 * Use as: { header: createSortHeader('My Column'), ... }
 */
export function createSortHeader<T = unknown>(label: string) {
  return ({ column }: { column: Column<T, unknown> }) => {
    const sorted = column.getIsSorted()
    const iconName = sorted === 'asc'
      ? 'i-lucide-chevron-up'
      : sorted === 'desc'
        ? 'i-lucide-chevron-down'
        : 'i-lucide-chevrons-up-down'
    return h('button', {
      class: 'flex items-center gap-1 font-semibold select-none cursor-pointer hover:text-highlighted transition-colors',
      onClick: () => column.toggleSorting()
    }, [
      label,
      h(UIcon, { name: iconName, class: ['shrink-0 size-3.5', !sorted && 'opacity-40'] })
    ])
  }
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export function formatDate(date: string | Date | number) {
  if (!date) return 'N/A'
  if (!isNaN(date as number))
    date = Number(date) * 1000 // convert seconds to milliseconds
  return new Date(date).toLocaleString()
}

export function formatDuration(ms?: number | null) {
  if (ms === null || ms === undefined) return 'N/A'

  return formatDurationLib({ seconds: ms / 1000 })
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'passed': return 'success'
    case 'failed': return 'error'
    case 'timedout': return 'warning'
    case 'interrupted': return 'warning'
    default: return 'neutral'
  }
}

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
