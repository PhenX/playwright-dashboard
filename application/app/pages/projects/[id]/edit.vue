<script setup lang="ts">
import { z } from 'zod'
import type { ProjectDetails, TagsResponse, TagInfo } from '~~/types/api'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const projectId = route.params.id

const { data: project } = await useFetch<ProjectDetails>(`/api/projects/${projectId}`)
const { data: tagsData, refresh: refreshTags } = await useFetch<TagsResponse>('/api/tags')

const allTags = computed(() => tagsData.value?.tags || [])

const state = ref({
  label: project.value?.label || '',
  description: project.value?.description || '',
  tagIds: (project.value?.tags || []).map((t: TagInfo) => t.id)
})

// Inline new tag creation
const newTagText = ref('')
const creatingTag = ref(false)

function randomHexColor(): string {
  const hue = Math.floor(Math.random() * 360)
  // Convert HSL to hex with decent saturation/lightness
  const s = 65, l = 50
  const c = (1 - Math.abs(2 * l / 100 - 1)) * s / 100
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1))
  const m = l / 100 - c / 2
  let r = 0, g = 0, b = 0
  if (hue < 60) { r = c; g = x }
  else if (hue < 120) { r = x; g = c }
  else if (hue < 180) { g = c; b = x }
  else if (hue < 240) { g = x; b = c }
  else if (hue < 300) { r = x; b = c }
  else { r = c; b = x }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

async function handleAddNewTag() {
  const text = newTagText.value.trim()
  if (!text) return

  // If tag already exists, just toggle it
  const existing = allTags.value.find(t => t.text.toLowerCase() === text.toLowerCase())
  if (existing) {
    if (!state.value.tagIds.includes(existing.id)) {
      state.value.tagIds.push(existing.id)
    }
    newTagText.value = ''
    return
  }

  try {
    creatingTag.value = true
    const result = await $fetch<{ tag: TagInfo }>('/api/tags', {
      method: 'POST',
      body: { text, color: randomHexColor() }
    })
    await refreshTags()
    state.value.tagIds.push(result.tag.id)
    newTagText.value = ''
  } catch (error: unknown) {
    const errorMessage = error && typeof error === 'object' && 'data' in error
      ? (error.data as { message?: string })?.message
      : undefined
    toast.add({
      title: 'Failed to create tag',
      description: errorMessage || 'An error occurred',
      color: 'error'
    })
  } finally {
    creatingTag.value = false
  }
}

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

            <UFormField label="Tags" name="tagIds" description="Click a tag to toggle it on/off. Type a new name and press Enter to create a tag with a random color.">
              <div class="space-y-2 mt-1">
                <!-- Existing tags toggle -->
                <div v-if="allTags.length > 0" class="flex flex-wrap gap-2">
                  <button
                    v-for="tag in allTags"
                    :key="tag.id"
                    type="button"
                    class="cursor-pointer focus:outline-none"
                    @click="toggleTag(tag.id)"
                  >
                    <TagBadge
                      :text="tag.text"
                      :color="tag.color"
                      :variant="isTagSelected(tag.id) ? 'solid' : 'outline'"
                      class="transition-all"
                    />
                  </button>
                </div>

                <!-- Inline new tag creation -->
                <div class="flex items-center gap-2">
                  <UInput
                    v-model="newTagText"
                    placeholder="Type a new tag name and press Enter..."
                    size="sm"
                    class="flex-1"
                    @keydown.enter.prevent="handleAddNewTag"
                  />
                  <UButton
                    size="sm"
                    variant="outline"
                    icon="i-lucide-plus"
                    :loading="creatingTag"
                    :disabled="!newTagText.trim()"
                    @click="handleAddNewTag"
                  >
                    Add Tag
                  </UButton>
                </div>
                <p class="text-xs text-muted">
                  New tags are created with a random color. You can change the color later in <NuxtLink to="/settings/tags" class="text-primary hover:underline">Settings → Tags</NuxtLink>.
                </p>
              </div>
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
