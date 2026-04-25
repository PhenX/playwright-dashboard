<script setup lang="ts">
import { z } from 'zod'
import type { ProjectDetails, TagsResponse } from '~~/types/api'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const projectId = route.params.id

const { data: project } = await useFetch<ProjectDetails>(`/api/projects/${projectId}`)
const { data: tagsData } = await useFetch<TagsResponse>('/api/tags')

const allTags = computed(() => tagsData.value?.tags || [])

const tagOptions = computed(() =>
  allTags.value.map(t => ({ label: t.text, value: t.id, color: t.color }))
)

const state = ref({
  label: project.value?.label || '',
  description: project.value?.description || '',
  tagIds: (project.value?.tags || []).map(t => t.id)
})

const schema = z.object({
  label: z.string().optional(),
  description: z.string().optional(),
  tagIds: z.array(z.number()).optional()
})

const saving = ref(false)

async function onSubmit() {
  try {
    saving.value = true

    const payload = {
      label: state.value.label || null,
      description: state.value.description || null,
      tagIds: state.value.tagIds
    }

    await $fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: payload
    })

    toast.add({
      title: 'Project updated',
      description: 'Project settings have been saved successfully',
      color: 'success'
    })

    // Navigate back to project page
    await router.push(`/projects/${projectId}`)
  } catch (error) {
    console.error('Error updating project:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to update project',
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

function onCancel() {
  router.push(`/projects/${projectId}`)
}

function isTagSelected(tagId: number) {
  return state.value.tagIds.includes(tagId)
}

function toggleTag(tagId: number) {
  const idx = state.value.tagIds.indexOf(tagId)
  if (idx === -1) {
    state.value.tagIds.push(tagId)
  } else {
    state.value.tagIds.splice(idx, 1)
  }
}
</script>

<template>
  <UDashboardPanel id="project-edit">
    <template #header>
      <UDashboardNavbar :title="`Edit ${project?.name || 'Project'}`">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-4 space-y-4">
        <UButton
          :to="`/projects/${projectId}`"
          icon="i-lucide-arrow-left"
          variant="ghost"
          size="sm"
        >
          Back to Project
        </UButton>

        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">
              Edit Project Settings
            </h2>
            <p class="text-sm text-gray-600 mt-1">
              Project Name: <span class="font-medium">{{ project?.name }}</span>
            </p>
            <p class="text-xs text-gray-500 mt-1">
              Note: The project name is used to match test results from the reporter and cannot be changed.
            </p>
          </template>

          <UForm
            :schema="schema"
            :state="state"
            class="space-y-4"
            @submit="onSubmit"
          >
            <UFormField label="Display Label" name="label" description="A friendly name to display in the UI (defaults to project name if not set)">
              <UInput v-model="state.label" placeholder="Enter display label" />
            </UFormField>

            <UFormField label="Description" name="description" description="A description of this project">
              <UTextarea v-model="state.description" placeholder="Enter project description" :rows="3" />
            </UFormField>

            <UFormField label="Tags" name="tagIds" description="Assign tags to this project for filtering">
              <div v-if="allTags.length > 0" class="flex flex-wrap gap-2 mt-1">
                <button
                  v-for="tag in allTags"
                  :key="tag.id"
                  type="button"
                  class="cursor-pointer focus:outline-none"
                  @click="toggleTag(tag.id)"
                >
                  <UBadge
                    :color="(tag.color as any)"
                    :variant="isTagSelected(tag.id) ? 'solid' : 'outline'"
                    class="transition-all"
                  >
                    {{ tag.text }}
                  </UBadge>
                </button>
              </div>
              <p v-else class="text-sm text-muted mt-1">
                No tags available. <NuxtLink to="/settings/tags" class="text-primary hover:underline">Create tags</NuxtLink> first.
              </p>
            </UFormField>

            <div class="flex gap-2 pt-4">
              <UButton type="submit" :loading="saving">
                Save Changes
              </UButton>
              <UButton variant="outline" @click="onCancel">
                Cancel
              </UButton>
            </div>
          </UForm>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
