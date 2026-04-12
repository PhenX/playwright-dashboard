<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { PerformanceTrendPoint, SlowTest, TestRunDetails, TestCaseResult, ProjectDetails } from '~~/types/api'

const route = useRoute()
const projectId = route.params.id

const { data: project } = await useFetch<ProjectDetails>(`/api/projects/${projectId}`)
const { data: performanceData, refresh: refreshPerformance } = await useFetch<PerformanceTrendPoint[]>(`/api/projects/${projectId}/performance`)
const { data: slowTests, refresh: refreshSlowTests } = await useFetch<SlowTest[]>(`/api/projects/${projectId}/slow-tests`)

const UBadge = resolveComponent('UBadge')

// Slow tests table columns
const slowTestsColumns: TableColumn<SlowTest>[] = [
  {
    accessorKey: 'title',
    header: 'Test Case',
    cell: ({ row }) => {
      return h('div', {}, [
        h('div', { class: 'font-medium' }, row.getValue('title')),
        h('code', { class: 'text-xs bg-gray-100 dark:bg-gray-800 p-1 rounded mt-1 block' }, row.original.filePath)
      ])
    }
  },
  {
    accessorKey: 'avgDuration',
    header: 'Avg Duration',
    cell: ({ row }) => formatDuration(row.getValue('avgDuration'))
  },
  {
    accessorKey: 'maxDuration',
    header: 'Max',
    cell: ({ row }) => formatDuration(row.getValue('maxDuration'))
  },
  {
    accessorKey: 'minDuration',
    header: 'Min',
    cell: ({ row }) => formatDuration(row.getValue('minDuration'))
  },
  {
    accessorKey: 'latestDuration',
    header: 'Latest',
    cell: ({ row }) => formatDuration(row.getValue('latestDuration'))
  },
  {
    accessorKey: 'trend',
    header: 'Trend',
    cell: ({ row }) => {
      const trend = row.getValue('trend') as string
      if (trend === 'slower') return h('span', { class: 'text-red-600 font-medium' }, '▲ Slower')
      if (trend === 'faster') return h('span', { class: 'text-green-600 font-medium' }, '▼ Faster')
      return h('span', { class: 'text-gray-500' }, '— Stable')
    }
  },
  {
    accessorKey: 'runCount',
    header: 'Runs',
    cell: ({ row }) => row.getValue('runCount')
  }
]

// ---- Run Comparison Feature ----
const runOptions = computed(() => {
  if (!performanceData.value) return []
  return [...performanceData.value].reverse().map(run => ({
    label: `Run #${run.id} — ${new Date(run.startTime).toLocaleDateString()}${run.commit ? ` (${run.commit.substring(0, 7)})` : ''}`,
    value: run.id
  }))
})

const selectedRunA = ref<number | null>(null)
const selectedRunB = ref<number | null>(null)

const { data: runADetails } = useFetch<TestRunDetails>(() =>
  selectedRunA.value ? `/api/test-runs/${selectedRunA.value}` : '', {
  immediate: false,
  watch: [selectedRunA]
})

const { data: runBDetails } = useFetch<TestRunDetails>(() =>
  selectedRunB.value ? `/api/test-runs/${selectedRunB.value}` : '', {
  immediate: false,
  watch: [selectedRunB]
})

interface ComparisonRow {
  title: string
  durationA: number | null
  durationB: number | null
  delta: number | null
  percentChange: number | null
}

const comparisonData = computed(() => {
  if (!runADetails.value?.testCases || !runBDetails.value?.testCases) return []

  const mapA = new Map<string, TestCaseResult>()
  for (const tc of runADetails.value.testCases) {
    mapA.set(tc.title, tc)
  }

  const rows: ComparisonRow[] = []
  for (const tcB of runBDetails.value.testCases) {
    const tcA = mapA.get(tcB.title)
    const durationA = tcA?.duration ?? null
    const durationB = tcB.duration ?? null

    let delta: number | null = null
    let percentChange: number | null = null
    if (durationA !== null && durationB !== null) {
      delta = durationB - durationA
      percentChange = durationA > 0 ? Math.round(((durationB - durationA) / durationA) * 100) : null
    }

    rows.push({
      title: tcB.title,
      durationA,
      durationB,
      delta,
      percentChange
    })
  }

  // Add tests only in run A
  for (const tcA of runADetails.value.testCases) {
    if (!rows.find(r => r.title === tcA.title)) {
      rows.push({
        title: tcA.title,
        durationA: tcA.duration ?? null,
        durationB: null,
        delta: null,
        percentChange: null
      })
    }
  }

  return rows.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
})

const comparisonSummary = computed(() => {
  const threshold = 10 // 10% threshold
  let improved = 0
  let regressed = 0
  let unchanged = 0

  for (const row of comparisonData.value) {
    if (row.percentChange === null) continue
    if (row.percentChange < -threshold) improved++
    else if (row.percentChange > threshold) regressed++
    else unchanged++
  }

  return { improved, regressed, unchanged }
})

const comparisonColumns: TableColumn<ComparisonRow>[] = [
  {
    accessorKey: 'title',
    header: 'Test Case',
    cell: ({ row }) => h('span', { class: 'font-medium' }, row.getValue('title'))
  },
  {
    accessorKey: 'durationA',
    header: 'Run A',
    cell: ({ row }) => {
      const val = row.getValue('durationA') as number | null
      return val !== null ? formatDuration(val) : h('span', { class: 'text-gray-400' }, '—')
    }
  },
  {
    accessorKey: 'durationB',
    header: 'Run B',
    cell: ({ row }) => {
      const val = row.getValue('durationB') as number | null
      return val !== null ? formatDuration(val) : h('span', { class: 'text-gray-400' }, '—')
    }
  },
  {
    accessorKey: 'delta',
    header: 'Delta',
    cell: ({ row }) => {
      const delta = row.getValue('delta') as number | null
      if (delta === null) return h('span', { class: 'text-gray-400' }, '—')
      const sign = delta > 0 ? '+' : ''
      const color = delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-600' : 'text-gray-500'
      return h('span', { class: color }, `${sign}${formatDuration(delta)}`)
    }
  },
  {
    accessorKey: 'percentChange',
    header: 'Change',
    cell: ({ row }) => {
      const pct = row.getValue('percentChange') as number | null
      if (pct === null) return h('span', { class: 'text-gray-400' }, '—')
      const sign = pct > 0 ? '+' : ''
      const color = pct > 10 ? 'text-red-600 font-medium' : pct < -10 ? 'text-green-600 font-medium' : 'text-gray-500'
      return h('span', { class: color }, `${sign}${pct}%`)
    }
  }
]

function refresh() {
  refreshPerformance()
  refreshSlowTests()
}
</script>

<template>
  <UDashboardPanel id="project-performance">
    <template #header>
      <UDashboardNavbar :title="`${project?.label || project?.name || 'Project'} — Performance`">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            size="md"
            label="Refresh"
            @click="refresh"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-4 space-y-6">
        <UButton
          :to="`/projects/${projectId}`"
          icon="i-lucide-arrow-left"
          variant="ghost"
          size="sm"
        >
          Back to Project
        </UButton>

        <!-- Performance Trend Chart -->
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">
              Performance Trend
            </h2>
            <p class="text-sm text-gray-600 mt-1">
              Duration metrics over time
            </p>
          </template>

          <PerformanceTrendChart :data="performanceData || []" :height="350" />
        </UCard>

        <!-- Slowest Tests -->
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">
              Slowest Tests
            </h2>
            <p class="text-sm text-gray-600 mt-1">
              Top 20 slowest test cases across recent runs
            </p>
          </template>

          <UTable
            v-if="slowTests && slowTests.length > 0"
            :data="slowTests"
            :columns="slowTestsColumns"
            :ui="{
              base: 'table-fixed border-separate border-spacing-0',
              thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
              tbody: '[&>tr]:last:[&>td]:border-b-0',
              th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
              td: 'border-b border-default'
            }"
          />

          <div v-else class="text-center py-8 text-gray-500">
            No slow test data available yet.
          </div>
        </UCard>

        <!-- Run Comparison -->
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">
              Run Comparison
            </h2>
            <p class="text-sm text-gray-600 mt-1">
              Compare two test runs side-by-side to see performance changes
            </p>
          </template>

          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Run A (baseline)</label>
                <USelectMenu
                  v-model="selectedRunA"
                  :items="runOptions"
                  value-key="value"
                  placeholder="Select run A..."
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Run B (comparison)</label>
                <USelectMenu
                  v-model="selectedRunB"
                  :items="runOptions"
                  value-key="value"
                  placeholder="Select run B..."
                />
              </div>
            </div>

            <!-- Comparison Summary -->
            <div v-if="selectedRunA && selectedRunB && comparisonData.length > 0" class="space-y-4">
              <div class="flex gap-4 text-sm">
                <UBadge color="success" variant="soft" size="lg">
                  {{ comparisonSummary.improved }} improved
                </UBadge>
                <UBadge color="error" variant="soft" size="lg">
                  {{ comparisonSummary.regressed }} regressed
                </UBadge>
                <UBadge color="neutral" variant="soft" size="lg">
                  {{ comparisonSummary.unchanged }} unchanged
                </UBadge>
              </div>

              <UTable
                :data="comparisonData"
                :columns="comparisonColumns"
                :ui="{
                  base: 'table-fixed border-separate border-spacing-0',
                  thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
                  tbody: '[&>tr]:last:[&>td]:border-b-0',
                  th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
                  td: 'border-b border-default'
                }"
              />
            </div>

            <div v-else-if="!selectedRunA || !selectedRunB" class="text-center py-8 text-gray-500">
              Select two runs to compare their performance.
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
