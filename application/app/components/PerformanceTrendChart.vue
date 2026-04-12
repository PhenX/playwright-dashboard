<script setup lang="ts">
import { VisXYContainer, VisLine, VisAxis, VisTooltip } from '@unovis/vue'
import { CurveType } from '@unovis/ts'
import type { PerformanceTrendPoint } from '~~/types/api'

interface Props {
  data: PerformanceTrendPoint[]
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  height: 300
})

// Transform data for the chart
const chartData = computed(() => {
  if (!props.data || props.data.length === 0) {
    return []
  }

  return props.data.map(point => ({
    date: new Date(point.startTime),
    duration: point.duration ? Math.round(point.duration / 1000) : null, // convert to seconds
    avgTestDuration: point.avgTestDuration ? Math.round(point.avgTestDuration / 1000) : null,
    p90TestDuration: point.p90TestDuration ? Math.round(point.p90TestDuration / 1000) : null,
    commit: point.commit ? point.commit.substring(0, 7) : null,
    status: point.status
  }))
})

type DataPoint = {
  date: Date
  duration: number | null
  avgTestDuration: number | null
  p90TestDuration: number | null
  commit: string | null
  status: string
}

const x = (d: DataPoint) => d.date

const yDuration = (d: DataPoint) => d.duration ?? undefined
const yAvgDuration = (d: DataPoint) => d.avgTestDuration ?? undefined
const yP90Duration = (d: DataPoint) => d.p90TestDuration ?? undefined

const lineColors = ['rgb(59, 130, 246)', 'rgb(34, 197, 94)', 'rgb(249, 115, 22)']
</script>

<template>
  <div v-if="chartData.length > 0" class="w-full">
    <VisXYContainer
      :data="chartData"
      :height="height"
      :padding="{ top: 10, right: 10, bottom: 40, left: 60 }"
    >
      <VisLine
        :x="x"
        :y="[yDuration, yAvgDuration, yP90Duration]"
        :color="lineColors"
        :curve-type="CurveType.MonotoneX"
        :line-width="2"
      />

      <VisAxis
        type="x"
        :tick-format="(d: Date) => (new Date(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })"
        label="Date"
      />
      <VisAxis
        type="y"
        label="Duration (s)"
        :tick-format="(d: number) => `${d}s`"
      />

      <VisTooltip />
    </VisXYContainer>

    <!-- Legend -->
    <div class="flex items-center justify-center gap-6 mt-4 text-sm">
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full bg-blue-500" />
        <span>Total Duration</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full bg-green-500" />
        <span>Avg Test Duration</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full bg-orange-500" />
        <span>P90 Test Duration</span>
      </div>
    </div>
  </div>

  <div v-else class="text-center py-12 text-gray-500">
    <p>No performance data available to display chart</p>
  </div>
</template>
