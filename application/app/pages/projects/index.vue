<script setup lang="ts">
import { h, resolveComponent, computed, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { ProjectWithStats, TagInfo, TagsResponse } from '~~/types/api'
import { formatDuration } from '~/utils'

const { data: projects, refresh } = await useFetch<ProjectWithStats[]>('/api/projects')
const { data: tagsData } = await useFetch<TagsResponse>('/api/tags')

const allTags = computed(() => tagsData.value?.tags || [])

// Search and filter state
const searchQuery = ref('')
const selectedTagIds = ref<number[]>([])

const filteredProjects = computed(() => {
  let result = projects.value || []

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    result = result.filter(p =>
      (p.label || p.name).toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
    )
  }

  if (selectedTagIds.value.length > 0) {
    result = result.filter(p =>
      selectedTagIds.value.every(tagId =>
        (p.tags || []).some(t => t.id === tagId)
      )
    )
  }

  return result
})

function toggleTagFilter(tagId: number) {
  const idx = selectedTagIds.value.indexOf(tagId)
  if (idx === -1) {
    selectedTagIds.value.push(tagId)
  } else {
    selectedTagIds.value.splice(idx, 1)
  }
}

function isTagFilterActive(tagId: number) {
  return selectedTagIds.value.includes(tagId)
}

const UBadge = resolveComponent('UBadge')
const TestStatusBar = resolveComponent('TestStatusBar')
const RunReports = resolveComponent('RunReports')

const columns: TableColumn<ProjectWithStats>[] = [
  {
    accessorKey: 'name',
    header: createSortHeader<ProjectWithStats>('Project Name'),
    cell: ({ row }) => {
      const displayName = (row.original.label || row.getValue('name')) as string
      const tags = (row.original.tags || []) as TagInfo[]

      return h('div', { class: 'flex flex-col gap-1' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h('a', {
            href: `/projects/${row.original.id}`,
            class: 'text-primary hover:underline font-medium text-lg',
            onClick: (e: MouseEvent) => {
              e.preventDefault()
              navigateTo(`/projects/${row.original.id}`)
            }
          }, displayName)
        ]),
        tags.length > 0
          ? h('div', { class: 'flex flex-wrap gap-1' },
              tags.map(tag =>
                h(UBadge, { color: tag.color, variant: 'subtle', size: 'xs' }, () => tag.text)
              )
            )
          : null
      ].filter(Boolean))
    }
  },
  {
    accessorKey: 'totalRuns',
    header: createSortHeader<ProjectWithStats>('Test Runs'),
    cell: ({ row }) => `${row.getValue('totalRuns')} runs`
  },
  {
    accessorKey: 'latestRun',
    header: createSortHeader<ProjectWithStats>('Last Run'),
    cell: ({ row }) => {
      const latestRun = row.getValue('latestRun') as ProjectWithStats['latestRun']
      return latestRun ? formatDate(latestRun.startTime) : 'N/A'
    }
  },
  {
    accessorKey: 'duration',
    header: createSortHeader<ProjectWithStats>('Duration'),
    cell: ({ row }) => {
      const latestRun = row.original.latestRun
      return latestRun?.duration != null ? formatDuration(latestRun.duration) : '—'
    }
  },
  {
    accessorKey: 'status',
    header: createSortHeader<ProjectWithStats>('Status'),
    cell: ({ row }) => {
      const latestRun = row.original.latestRun
      if (!latestRun) return ''

      const color = getStatusColor(latestRun.status)
      return h(UBadge, { color, size: 'md', class: 'capitalize' }, () => latestRun.status)
    }
  },
  {
    accessorKey: 'testRatio',
    header: 'Test Status',
    cell: ({ row }) => {
      const latestRun = row.original.latestRun
      if (!latestRun) return h('span', { class: 'text-xs text-gray-400 italic' }, 'No data')

      return h(TestStatusBar, {
        passed: latestRun.passedTests,
        failed: latestRun.failedTests,
        skipped: latestRun.skippedTests,
        flaky: latestRun.flakyTests,
        total: latestRun.totalTests
      })
    }
  },
  {
    accessorKey: 'report',
    header: 'Reports',
    cell: ({ row }) => {
      const latestRun = row.original.latestRun
      if (!latestRun) return ''
      return h(RunReports, {
        reports: latestRun.reports,
        legacyPath: latestRun.reportPath,
        legacySize: latestRun.reportSize
      })
    }
  },
  {
    accessorKey: 'actions',
    header: () => h('div', { class: 'text-right' }, 'Actions'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      return h('div', { class: 'flex justify-end gap-2' }, [
        h(UButton, {
          to: `/projects/${row.original.id}`,
          size: 'sm',
          variant: 'outline'
        }, () => 'View Details'),
        h(UButton, {
          to: `/projects/${row.original.id}/edit`,
          size: 'sm',
          variant: 'ghost',
          icon: 'i-lucide-pencil'
        }, () => 'Edit')
      ])
    }
  }
]
</script>

<template>
  <UDashboardPanel id="projects">
    <template #header>
      <UDashboardNavbar title="Projects">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            size="md"
            label="Refresh"
            @click="() => refresh()"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Search and filter toolbar -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Search projects by name..."
          class="min-w-48 flex-1"
          :ui="{ base: 'w-full' }"
        />

        <div v-if="allTags.length > 0" class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-muted shrink-0">Filter by tag:</span>
          <button
            v-for="tag in allTags"
            :key="tag.id"
            type="button"
            class="cursor-pointer focus:outline-none"
            @click="toggleTagFilter(tag.id)"
          >
            <UBadge
              :color="(tag.color as any)"
              :variant="isTagFilterActive(tag.id) ? 'solid' : 'outline'"
              class="transition-all"
            >
              {{ tag.text }}
            </UBadge>
          </button>

          <UButton
            v-if="selectedTagIds.length > 0"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            label="Clear filters"
            @click="selectedTagIds = []"
          />
        </div>
      </div>

      <UTable
        v-if="filteredProjects.length > 0"
        :data="filteredProjects"
        :columns="columns"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default'
        }"
      />

      <div v-else-if="projects && projects.length > 0" class="text-center py-12 text-gray-500">
        <p class="text-lg mb-2">
          No projects match your search
        </p>
        <p class="text-sm">
          Try adjusting your search or filters
        </p>
      </div>

      <div v-else class="text-center py-12 text-gray-500">
        <p class="text-lg mb-2">
          No projects yet
        </p>
        <p class="text-sm">
          Submit test results via the API to create projects
        </p>
      </div>
    </template>
  </UDashboardPanel>
</template>
