<script setup lang="ts">
import type { PerformanceStep } from '~~/types/api'
import { getPerformanceHints } from '~/utils/performance-hints'

const route = useRoute()
const testCaseId = route.params.id

const { data: testCase, refresh } = await useFetch(`/api/test-cases/${testCaseId}`)

const performanceHints = computed(() => {
  if (!testCase.value) return []
  return getPerformanceHints(testCase.value)
})

const steps = computed(() => {
  if (!testCase.value?.steps) return []
  return testCase.value.steps as PerformanceStep[]
})
</script>

<template>
  <UDashboardPanel id="test-case-detail">
    <template #header>
      <UDashboardNavbar title="Test Case Details">
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
          :to="`/test-runs/${testCase?.testRun?.id}`"
          icon="i-lucide-arrow-left"
          variant="ghost"
          size="sm"
        >
          Back to Test Run
        </UButton>

        <UCard>
          <template #header>
            <div class="flex justify-between items-center">
              <h2 class="text-xl font-semibold">
                Test Case #{{ testCase?.id }}
              </h2>
              <UBadge v-if="testCase" :color="getStatusColor(testCase.status)" size="lg">
                {{ testCase.status }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-4">
            <div>
              <p class="text-sm text-gray-500">
                Title
              </p>
              <p class="font-medium text-lg">
                {{ testCase?.title }}
              </p>
            </div>

            <div v-if="testCase?.location">
              <p class="text-sm text-gray-500">
                Location
              </p>
              <code class="text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded block">{{ testCase.location }}</code>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p class="text-sm text-gray-500">
                  Duration
                </p>
                <p class="font-medium">
                  {{ formatDuration(testCase?.duration) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">
                  Retries
                </p>
                <p class="font-medium">
                  {{ testCase?.retries }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">
                  Status
                </p>
                <p class="font-medium">
                  {{ testCase?.status }}
                </p>
              </div>
              <div v-if="testCase?.slowestStep">
                <p class="text-sm text-gray-500">
                  Slowest Step
                </p>
                <p class="font-medium text-orange-600">
                  {{ testCase.slowestStep }}
                  <span v-if="testCase.slowestStepDuration" class="text-sm">
                    ({{ formatDuration(testCase.slowestStepDuration) }})
                  </span>
                </p>
              </div>
            </div>

            <div v-if="testCase?.error" class="pt-4 border-t">
              <p class="text-sm text-gray-500 mb-2">
                Error Details
              </p>
              <pre class="text-sm bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-4 rounded overflow-x-auto">{{ testCase.error }}</pre>
            </div>
          </div>
        </UCard>

        <!-- Performance Hints -->
        <div v-if="performanceHints.length > 0" class="space-y-2">
          <div
            v-for="(hint, index) in performanceHints"
            :key="index"
            :class="[
              'p-3 rounded-lg border text-sm',
              hint.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            ]"
          >
            <div class="flex items-start gap-2">
              <UIcon
                :name="hint.type === 'warning' ? 'i-lucide-alert-triangle' : 'i-lucide-lightbulb'"
                :class="hint.type === 'warning' ? 'text-amber-600' : 'text-blue-600'"
                class="size-4 mt-0.5 shrink-0"
              />
              <div>
                <p :class="hint.type === 'warning' ? 'text-amber-800 dark:text-amber-200 font-medium' : 'text-blue-800 dark:text-blue-200 font-medium'">
                  {{ hint.message }}
                </p>
                <p :class="hint.type === 'warning' ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'" class="mt-1">
                  {{ hint.details }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Steps Table -->
        <UCard v-if="steps.length > 0">
          <template #header>
            <h3 class="text-lg font-medium">
              Steps ({{ steps.length }})
            </h3>
          </template>

          <div class="space-y-1 max-h-96 overflow-y-auto">
            <div
              v-for="(step, index) in steps"
              :key="index"
              class="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
            >
              <div class="flex items-center gap-2 min-w-0">
                <UBadge
                  :color="step.category === 'navigation' ? 'info' : step.category === 'assertion' ? 'success' : step.category === 'action' ? 'warning' : 'neutral'"
                  variant="soft"
                  size="xs"
                >
                  {{ step.category }}
                </UBadge>
                <span class="truncate">{{ step.title }}</span>
              </div>
              <span class="text-gray-500 ml-2 shrink-0">{{ formatDuration(step.duration) }}</span>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
