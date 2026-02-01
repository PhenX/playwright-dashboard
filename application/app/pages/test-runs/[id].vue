<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { TestRunDetails, TestCaseResult } from '~~/types/api'
import { formatBytes, getFileApiPath } from '~/utils'

const route = useRoute()
const runId = route.params.id

const { data: testRun, refresh } = await useFetch<TestRunDetails>(`/api/test-runs/${runId}`)

const UBadge = resolveComponent('UBadge')

const testCasesColumns: TableColumn<TestCaseResult>[] = [
  {
    accessorKey: 'title',
    header: 'Test Case',
    cell: ({ row }) => {
      return h('a', {
        href: `/test-cases/${row.original.id}`,
        class: 'text-primary hover:underline font-medium',
        onClick: (e: MouseEvent) => {
          e.preventDefault()
          navigateTo(`/test-cases/${row.original.id}`)
        }
      }, row.getValue('title'))
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const color = getStatusColor(row.getValue('status') as string)
      return h(UBadge, { color, class: 'capitalize' }, () => row.getValue('status'))
    }
  },
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => {
      const location = row.getValue('location') as string | undefined
      return location ? h('code', { class: 'text-xs' }, location) : ''
    }
  },
  {
    accessorKey: 'duration',
    header: 'Duration',
    cell: ({ row }) => formatDuration(row.getValue('duration'))
  },
  {
    accessorKey: 'retries',
    header: 'Retries',
    cell: ({ row }) => {
      const retries = row.getValue('retries') as number | undefined
      return retries && retries > 0 ? retries.toString() : ''
    }
  },
  {
    accessorKey: 'actions',
    header: () => h('div', { class: 'text-right' }, 'Actions'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      return h('div', { class: 'flex justify-end' },
        h(UButton, {
          to: `/test-cases/${row.original.id}`,
          size: 'sm',
          variant: 'outline'
        }, () => 'View Details')
      )
    }
  }
]
</script>

<template>
  <UDashboardPanel id="test-run-detail">
    <template #header>
      <UDashboardNavbar title="Test Run Details">
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
      <div class="p-4 space-y-4">
        <UButton
          :to="`/projects/${testRun?.project?.id}`"
          icon="i-lucide-arrow-left"
          variant="ghost"
          size="sm"
        >
          Back to Project
        </UButton>

        <UCard>
          <template #header>
            <div class="flex justify-between items-center">
              <h2 class="text-xl font-semibold">
                Test Run #{{ testRun?.id }}
              </h2>
              <UBadge v-if="testRun" :color="getStatusColor(testRun.status)" size="lg">
                {{ testRun.status }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-4">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p class="text-sm text-gray-500">
                  Project
                </p>
                <p class="font-medium">
                  {{ testRun?.project?.name }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">
                  Total Tests
                </p>
                <p class="font-medium">
                  {{ testRun?.totalTests }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">
                  Passed
                </p>
                <p class="font-medium text-green-600">
                  {{ testRun?.passedTests }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">
                  Failed
                </p>
                <p class="font-medium text-red-600">
                  {{ testRun?.failedTests }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">
                  Skipped
                </p>
                <p class="font-medium">
                  {{ testRun?.skippedTests }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">
                  Duration
                </p>
                <p class="font-medium">
                  {{ formatDuration(testRun?.duration) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">
                  Start Time
                </p>
                <p class="font-medium">
                  {{ testRun?.startTime ? new Date(testRun.startTime).toLocaleString() : 'N/A' }}
                </p>
              </div>
            </div>

            <div v-if="testRun?.reportPath" class="pt-4 border-t">
              <p class="text-sm text-gray-500 mb-2">
                HTML Report
              </p>
              <div class="flex items-center gap-2 mb-2">
                <code class="text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded flex-1">{{ testRun.reportPath }}</code>
                <UButton
                  :to="`/api/files/${getFileApiPath(testRun.reportPath)}`"
                  target="_blank"
                  size="sm"
                  icon="i-lucide-external-link"
                >
                  View Report
                </UButton>
              </div>
              <div v-if="testRun?.reportSize" class="text-sm text-gray-600">
                <span class="text-gray-500">Report Size (decompressed):</span>
                <span class="ml-2 font-medium">{{ formatBytes(testRun.reportSize) }}</span>
              </div>
            </div>

            <!-- Metadata Section -->
            <div v-if="testRun?.metadata" class="pt-4 border-t">
              <p class="text-sm text-gray-500 mb-3">
                Metadata
              </p>
              <div class="space-y-3">
                <!-- Project Description -->
                <div v-if="testRun.metadata.projectDescription">
                  <p class="text-xs text-gray-500 uppercase">
                    Description
                  </p>
                  <p class="text-sm">
                    {{ testRun.metadata.projectDescription }}
                  </p>
                </div>

                <!-- Related Issue -->
                <div v-if="testRun.metadata.relatedIssue">
                  <p class="text-xs text-gray-500 uppercase">
                    Related Issue
                  </p>
                  <p class="text-sm">
                    {{ testRun.metadata.relatedIssue }}
                  </p>
                </div>

                <!-- CI Info -->
                <div v-if="testRun.metadata.ci" class="space-y-2">
                  <p class="text-xs text-gray-500 uppercase">
                    CI Information
                  </p>
                  <div class="grid grid-cols-2 gap-2 text-sm">
                    <div v-if="testRun.metadata.ci.provider">
                      <span class="text-gray-500">Provider:</span>
                      <span class="ml-2 font-medium">{{ testRun.metadata.ci.provider }}</span>
                    </div>
                    <div v-if="testRun.metadata.ci.buildNumber">
                      <span class="text-gray-500">Build:</span>
                      <span class="ml-2 font-medium">{{ testRun.metadata.ci.buildNumber }}</span>
                    </div>
                    <div v-if="testRun.metadata.ci.buildUrl" class="col-span-2">
                      <a :href="testRun.metadata.ci.buildUrl" target="_blank" class="text-primary hover:underline flex items-center gap-1">
                        <span>View Build</span>
                        <UIcon name="i-lucide-external-link" class="w-3 h-3" />
                      </a>
                    </div>
                    <div v-if="testRun.metadata.ci.jobName">
                      <span class="text-gray-500">Job:</span>
                      <span class="ml-2 font-medium">{{ testRun.metadata.ci.jobName }}</span>
                    </div>
                    <div v-if="testRun.metadata.ci.workflow">
                      <span class="text-gray-500">Workflow:</span>
                      <span class="ml-2 font-medium">{{ testRun.metadata.ci.workflow }}</span>
                    </div>
                  </div>
                </div>

                <!-- SCM Info -->
                <div v-if="testRun.metadata.scm" class="space-y-2">
                  <p class="text-xs text-gray-500 uppercase">
                    Source Control
                  </p>
                  <div class="space-y-1 text-sm">
                    <div v-if="testRun.metadata.scm.commit">
                      <span class="text-gray-500">Commit:</span>
                      <code class="ml-2 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{{ testRun.metadata.scm.commit.substring(0, 8) }}</code>
                    </div>
                    <div v-if="testRun.metadata.scm.branch">
                      <span class="text-gray-500">Branch:</span>
                      <span class="ml-2 font-medium">{{ testRun.metadata.scm.branch }}</span>
                    </div>
                    <div v-if="testRun.metadata.scm.author">
                      <span class="text-gray-500">Author:</span>
                      <span class="ml-2 font-medium">{{ testRun.metadata.scm.author }}</span>
                    </div>
                    <div v-if="testRun.metadata.scm.commitMessage">
                      <span class="text-gray-500">Message:</span>
                      <span class="ml-2">{{ testRun.metadata.scm.commitMessage }}</span>
                    </div>
                  </div>
                </div>

                <!-- Tags -->
                <div v-if="testRun.metadata.tags && testRun.metadata.tags.length > 0">
                  <p class="text-xs text-gray-500 uppercase mb-2">
                    Tags
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <UBadge v-for="tag in testRun.metadata.tags" :key="tag" color="gray" variant="soft">
                      {{ tag }}
                    </UBadge>
                  </div>
                </div>

                <!-- Custom Data -->
                <div v-if="testRun.metadata.customData">
                  <p class="text-xs text-gray-500 uppercase mb-2">
                    Custom Data
                  </p>
                  <div class="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs font-mono overflow-x-auto">
                    <pre>{{ JSON.stringify(testRun.metadata.customData, null, 2) }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="text-lg font-medium">
              Test Cases
            </h3>
          </template>

          <UTable
            v-if="testRun?.testCases && testRun.testCases.length > 0"
            :data="testRun.testCases"
            :columns="testCasesColumns"
            :ui="{
              base: 'table-fixed border-separate border-spacing-0',
              thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
              tbody: '[&>tr]:last:[&>td]:border-b-0',
              th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
              td: 'border-b border-default'
            }"
          />

          <div v-else class="text-center py-8 text-gray-500">
            No test cases recorded for this run.
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
